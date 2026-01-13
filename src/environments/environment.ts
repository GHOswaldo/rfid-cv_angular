// src/environments/environment.ts (Corregido)

// NO necesitas importar 'initializeApp' aquí, ni inicializar 'app'.

export const environment = {
  production: false,
  // Este es el objeto CRÍTICO que la aplicación necesita importar.
  firebaseConfig: { 
  apiKey: "AIzaSyBMfnnsR2r_URSMyuqZNwhY69ugzVkz4ec",
  authDomain: "redesita-574b3.firebaseapp.com",
  databaseURL: "https://redesita-574b3-default-rtdb.firebaseio.com",
  projectId: "redesita-574b3",
  storageBucket: "redesita-574b3.firebasestorage.app",
  messagingSenderId: "1051994375716",
  appId: "1:1051994375716:web:c2e7b2e8dab704311c3ab1"
  }
};