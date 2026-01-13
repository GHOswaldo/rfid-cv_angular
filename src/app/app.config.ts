import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getDatabase, provideDatabase } from '@angular/fire/database';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), 
    provideFirebaseApp(() => initializeApp({ 
  apiKey: "AIzaSyBMfnnsR2r_URSMyuqZNwhY69ugzVkz4ec",
  authDomain: "redesita-574b3.firebaseapp.com",
  databaseURL: "https://redesita-574b3-default-rtdb.firebaseio.com",
  projectId: "redesita-574b3",
  storageBucket: "redesita-574b3.firebasestorage.app",
  messagingSenderId: "1051994375716",
  appId: "1:1051994375716:web:c2e7b2e8dab704311c3ab1"
    })), 
    provideAuth(() => getAuth()), 
    provideDatabase(() => getDatabase())
  ]
};