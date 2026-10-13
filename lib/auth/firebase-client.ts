'use client'

// yt-2: Firebase is not used. This driver signs every login in immediately as the demo account, so the
// login screen and its flows can be designed without any identity provider.

import type { FirebaseAuthDriver, FirebaseUserLike } from './client-auth-service'

import { MOCK_TENANT } from '@/mock/vocabulary'

const mockUser: FirebaseUserLike = {
  email: MOCK_TENANT.email,
  emailVerified: true,
  photoURL: null,
  async getIdToken() {
    return 'mock-id-token'
  },
  async reload() {},
}

export function createFirebaseAuthDriver(): FirebaseAuthDriver {
  return {
    async signInWithGoogle() {
      return mockUser
    },
    async signInWithEmail() {
      return mockUser
    },
    async createEmailUser() {
      return mockUser
    },
    async sendEmailVerification() {},
    currentUser() {
      return mockUser
    },
    async signOut() {},
  }
}
