import { produce } from 'immer';
import useConversationApi from './useConversationApi';

const useConversation = () => {
  const conversationApi = useConversationApi();

  const { data: conversations, isLoading: isLoadingConversations } =
    conversationApi.getConversations();
  const mutate = conversationApi.mutateConversations;

  const { data: folders, isLoading: isLoadingFolders } =
    conversationApi.getFolders();
  const mutateFolders = conversationApi.mutateFolders;

  return {
    conversations,
    isLoadingConversations,
    mutateConversations: mutate,
    folders,
    isLoadingFolders,
    mutateFolders,
    syncConversations: () => {
      return mutate(conversations);
    },
    getTitle: (conversationId: string) => {
      return (
        conversations?.find((c) => c.id === conversationId)?.title ?? 'New Chat'
      );
    },
    getBotId: (conversationId: string) => {
      return conversations?.find((c) => c.id === conversationId)?.botId ?? null;
    },
    deleteConversation: (conversationId: string) => {
      // Optimistic update: Update UI before deletion
      mutate(
        produce(conversations, (draft) => {
          if (draft) {
            const index = draft.findIndex((c) => c.id === conversationId);
            if (index !== -1) {
              draft.splice(index, 1);
            }
          }
        }),
        { revalidate: false }
      );

      // Actual API call
      return conversationApi
        .deleteConversation(conversationId)
        .then(() => {
          // Revalidate after successful deletion to ensure UI is in sync
          mutate();
        })
        .catch((error) => {
          console.error('Failed to delete conversation:', error);
          // Revert to original state on error
          mutate();
          throw error; // Re-throw error so it can be caught by the caller
        });
    },
    deleteConversations: (conversationIds: string[]) => {
      const idSet = new Set(conversationIds);
      // Optimistic update: drop all selected conversations at once.
      mutate(
        produce(conversations, (draft) => {
          if (draft) {
            for (let i = draft.length - 1; i >= 0; i--) {
              if (idSet.has(draft[i].id)) {
                draft.splice(i, 1);
              }
            }
          }
        }),
        { revalidate: false }
      );

      // Delete in small concurrency-limited batches. Firing every delete at
      // once raced the Amplify token refresh in the axios interceptor, so
      // some requests silently failed and the rows came back after a refresh.
      // allSettled means one failure can't abort the rest; we always
      // revalidate at the end so the UI reconciles with the server (anything
      // that failed to delete reappears, everything that succeeded stays gone).
      const runBatchedDeletes = async () => {
        const BATCH_SIZE = 5;
        const failedIds: string[] = [];
        for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
          const batch = conversationIds.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((id) => conversationApi.deleteConversation(id))
          );
          results.forEach((result, idx) => {
            if (result.status === 'rejected') {
              failedIds.push(batch[idx]);
              console.error(
                'Failed to delete conversation:',
                batch[idx],
                result.reason
              );
            }
          });
        }
        await mutate();
        if (failedIds.length > 0) {
          throw new Error(
            `Failed to delete ${failedIds.length} conversation(s)`
          );
        }
      };

      return runBatchedDeletes();
    },
    clearConversations: () => {
      return mutate(async () => {
        await conversationApi.clearConversations();
        return [];
      });
    },
    updateTitle: (conversationId: string, title: string) => {
      // Optimistic update
      mutate(
        produce(conversations, (draft) => {
          if (draft) {
            const target = draft.find((c) => c.id === conversationId);
            if (target) {
              target.title = title;
            }
          }
        }),
        { revalidate: false }
      );

      // Actual API call
      return conversationApi
        .updateTitle(conversationId, title)
        .catch((error) => {
          console.error('Failed to update title:', error);
          // Revert to original state on error
          mutate();
          throw error; // Re-throw error so it can be caught by the caller
        });
    },
    createFolder: (name: string) => {
      return conversationApi.createFolder(name).then((res) => {
        mutateFolders();
        return res.data;
      });
    },
    renameFolder: (folderId: string, name: string) => {
      // Optimistic update
      mutateFolders(
        produce(folders, (draft) => {
          if (draft) {
            const target = draft.find((f) => f.id === folderId);
            if (target) {
              target.name = name;
            }
          }
        }),
        { revalidate: false }
      );

      return conversationApi.updateFolderName(folderId, name).catch((error) => {
        console.error('Failed to rename folder:', error);
        mutateFolders();
        throw error;
      });
    },
    deleteFolder: (folderId: string) => {
      // Optimistic update: drop the folder from the list
      mutateFolders(
        produce(folders, (draft) => {
          if (draft) {
            const index = draft.findIndex((f) => f.id === folderId);
            if (index !== -1) {
              draft.splice(index, 1);
            }
          }
        }),
        { revalidate: false }
      );

      return conversationApi
        .deleteFolder(folderId)
        .then(() => {
          // Conversations in this folder are now unfiled; refresh both lists.
          mutate();
          mutateFolders();
        })
        .catch((error) => {
          console.error('Failed to delete folder:', error);
          mutateFolders();
          throw error;
        });
    },
    moveConversationToFolder: (
      conversationId: string,
      folderId: string | null
    ) => {
      // Optimistic update
      mutate(
        produce(conversations, (draft) => {
          if (draft) {
            const target = draft.find((c) => c.id === conversationId);
            if (target) {
              target.folderId = folderId;
            }
          }
        }),
        { revalidate: false }
      );

      return conversationApi
        .moveConversationToFolder(conversationId, folderId)
        .catch((error) => {
          console.error('Failed to move conversation:', error);
          mutate();
          throw error;
        });
    },
  };
};

export default useConversation;
