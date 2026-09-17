import uuid

from app.repositories.conversation import (
    change_conversation_title,
    change_folder_name,
    delete_conversation_by_id,
    delete_conversation_by_user_id,
    delete_folder,
    find_conversation_by_user_id,
    find_folders_by_user_id,
    find_related_document_by_id,
    find_related_documents_by_conversation_id,
    move_conversation_to_folder,
    store_folder,
    update_feedback,
)
from app.repositories.models.conversation import FeedbackModel, FolderModel
from app.routes.schemas.conversation import (
    ChatInput,
    ChatOutput,
    Conversation,
    ConversationMetaOutput,
    ConversationSearchResult,
    FeedbackInput,
    FeedbackOutput,
    FolderNameInput,
    FolderOutput,
    MoveConversationInput,
    NewFolderInput,
    NewTitleInput,
    ProposedTitle,
    RelatedDocument,
)
from app.utils import get_current_time
from app.usecases.chat import (
    chat,
    chat_output_from_message,
    fetch_conversation,
    propose_conversation_title,
    search_conversations as search_conversations_usecase,
)
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["conversation"])


@router.get("/health")
def health():
    """For health check"""
    return {"status": "ok"}


@router.post("/conversation", response_model=ChatOutput)
def post_message(request: Request, chat_input: ChatInput):
    """Send chat message"""
    current_user: User = request.state.current_user

    conversation, message = chat(user=current_user, chat_input=chat_input)
    output = chat_output_from_message(conversation=conversation, message=message)
    return output


@router.get(
    "/conversation/{conversation_id}/related-documents",
    response_model=list[RelatedDocument],
)
def get_related_documents(
    request: Request, conversation_id: str
) -> list[RelatedDocument]:
    """Get related documents"""
    current_user: User = request.state.current_user

    related_documents = find_related_documents_by_conversation_id(
        user_id=current_user.id,
        conversation_id=conversation_id,
    )
    return [related_document.to_schema() for related_document in related_documents]


@router.get(
    "/conversation/{conversation_id}/related-documents/{source_id}",
    response_model=RelatedDocument,
)
def get_related_document(
    request: Request, conversation_id: str, source_id: str
) -> RelatedDocument:
    """Get a related document"""
    current_user: User = request.state.current_user

    related_document = find_related_document_by_id(
        user_id=current_user.id,
        conversation_id=conversation_id,
        source_id=source_id,
    )
    return related_document.to_schema()


@router.get("/conversation/{conversation_id}", response_model=Conversation)
def get_conversation(request: Request, conversation_id: str):
    """Get a conversation history"""
    current_user: User = request.state.current_user

    output = fetch_conversation(current_user.id, conversation_id)
    return output


@router.delete("/conversation/{conversation_id}")
def remove_conversation(request: Request, conversation_id: str):
    """Delete conversation"""
    current_user: User = request.state.current_user

    delete_conversation_by_id(current_user.id, conversation_id)


@router.get("/conversations", response_model=list[ConversationMetaOutput])
def get_all_conversations(
    request: Request,
):
    """Get all conversation metadata"""
    current_user: User = request.state.current_user

    conversations = find_conversation_by_user_id(current_user.id)
    output = [
        ConversationMetaOutput(
            id=conversation.id,
            title=conversation.title,
            create_time=conversation.create_time,
            model=conversation.model,
            bot_id=conversation.bot_id,
            agent_id=conversation.agent_id,
            folder_id=conversation.folder_id,
        )
        for conversation in conversations
    ]
    return output


@router.delete("/conversations")
def remove_all_conversations(request: Request):
    """Delete all conversations"""
    delete_conversation_by_user_id(request.state.current_user.id)


@router.get("/conversations/search", response_model=list[ConversationSearchResult])
def search_conversations(request: Request, query: str):
    """Search conversations by keyword"""
    current_user: User = request.state.current_user
    output = search_conversations_usecase(query, current_user)
    return output


@router.patch("/conversation/{conversation_id}/title")
def patch_conversation_title(
    request: Request, conversation_id: str, new_title_input: NewTitleInput
):
    """Update conversation title"""
    current_user: User = request.state.current_user

    change_conversation_title(
        current_user.id, conversation_id, new_title_input.new_title
    )


@router.get("/folders", response_model=list[FolderOutput])
def get_all_folders(request: Request):
    """List all of the current user's folders"""
    current_user: User = request.state.current_user
    folders = find_folders_by_user_id(current_user.id)
    return [
        FolderOutput(id=f.id, name=f.name, create_time=f.create_time) for f in folders
    ]


@router.post("/folders", response_model=FolderOutput)
def post_folder(request: Request, new_folder_input: NewFolderInput):
    """Create a new folder"""
    current_user: User = request.state.current_user
    folder = FolderModel(
        id=str(uuid.uuid4()),
        name=new_folder_input.name,
        create_time=get_current_time(),
    )
    store_folder(current_user.id, folder)
    return FolderOutput(id=folder.id, name=folder.name, create_time=folder.create_time)


@router.patch("/folders/{folder_id}")
def patch_folder(request: Request, folder_id: str, folder_name_input: FolderNameInput):
    """Rename a folder"""
    current_user: User = request.state.current_user
    change_folder_name(current_user.id, folder_id, folder_name_input.name)


@router.delete("/folders/{folder_id}")
def remove_folder(request: Request, folder_id: str):
    """Delete a folder. Conversations inside are unfiled, not deleted."""
    current_user: User = request.state.current_user
    delete_folder(current_user.id, folder_id)


@router.patch("/conversation/{conversation_id}/folder")
def patch_conversation_folder(
    request: Request, conversation_id: str, move_input: MoveConversationInput
):
    """Move a conversation into a folder (or unfile it when folder_id is null)"""
    current_user: User = request.state.current_user
    move_conversation_to_folder(current_user.id, conversation_id, move_input.folder_id)


@router.get(
    "/conversation/{conversation_id}/proposed-title", response_model=ProposedTitle
)
def get_proposed_title(request: Request, conversation_id: str):
    """Suggest conversation title"""
    current_user: User = request.state.current_user

    title = propose_conversation_title(current_user.id, conversation_id)
    return ProposedTitle(title=title)


@router.put(
    "/conversation/{conversation_id}/{message_id}/feedback",
    response_model=FeedbackOutput,
)
def put_feedback(
    request: Request,
    conversation_id: str,
    message_id: str,
    feedback_input: FeedbackInput,
):
    """Send feedback."""
    current_user: User = request.state.current_user

    update_feedback(
        user_id=current_user.id,
        conversation_id=conversation_id,
        message_id=message_id,
        feedback=FeedbackModel(
            thumbs_up=feedback_input.thumbs_up,
            category=feedback_input.category if feedback_input.category else "",
            comment=feedback_input.comment if feedback_input.comment else "",
        ),
    )
    return FeedbackOutput(
        thumbs_up=feedback_input.thumbs_up,
        category=feedback_input.category if feedback_input.category else "",
        comment=feedback_input.comment if feedback_input.comment else "",
    )
