import { UserProfile, UserProfileInput } from '../@types/profile';
import useHttp from './useHttp';

const useProfileApi = () => {
  const http = useHttp();

  return {
    profile: () => {
      return http.get<UserProfile>('profile');
    },
    updateProfile: (params: UserProfileInput) => {
      return http.put<UserProfile, UserProfileInput>('profile', params);
    },
    clearProfile: () => {
      return http.delete('profile');
    },
    // Update the profile from the latest turn. Fire-and-forget after a turn.
    reflect: (conversationId: string) => {
      return http.post<{ changed: boolean }, { conversationId: string }>(
        'profile/reflect',
        { conversationId }
      );
    },
  };
};

export default useProfileApi;
