import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

export async function uploadFile(
  file: File,
  setProgress?: (progress: number) => void,
  firebaseToken?: string,
) {
  return new Promise(async (resolve, reject) => {
    try {
      // Sign in to Firebase with the Clerk token if provided
      if (firebaseToken) {
        await signInWithCustomToken(auth, firebaseToken);
      }

      // Create a unique filename to avoid collisions
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const storageRef = ref(storage, `meetings/${uniqueFileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );

          if (setProgress) setProgress(progress);

          switch (snapshot.state) {
            case "paused":
              console.log("Upload is paused");
              break;
            case "running":
              console.log("Upload is running");
              break;
          }
        },
        (error) => {
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL as string);
          });
        },
      );
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
}

export async function deleteFile(fileUrl: string, firebaseToken?: string) {
  try {
    // Sign in to Firebase with the token if provided
    if (firebaseToken) {
      await signInWithCustomToken(auth, firebaseToken);
    }

    if (!auth.currentUser) {
      console.warn("No authenticated user for Firebase deletion");
    }

    // Parse the Firebase Storage URL format
    // Extract the file path from the URL by taking everything after '/o/'
    const filePathMatch = fileUrl.match(/\/o\/([^?]+)/);

    if (!filePathMatch || !filePathMatch[1]) {
      throw new Error(`Could not extract file path from URL: ${fileUrl}`);
    }

    // Decode the URL-encoded path
    const encodedPath = filePathMatch[1];
    const filePath = decodeURIComponent(encodedPath);

    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    return true;
  } catch (error) {
    console.error("Error deleting file from Firebase Storage:", error);
    throw error;
  }
}
