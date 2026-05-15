import * as Keychain from 'react-native-keychain';

export class AuthService {
  static async setToken(token: string) {
    await Keychain.setGenericPassword('rapide_ticket_user', token);
  }

  static async getToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  static async clearToken() {
    await Keychain.resetGenericPassword();
  }
}
