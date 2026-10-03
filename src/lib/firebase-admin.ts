import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: "squirrel-4f5a6",
        clientEmail: "firebase-adminsdk-fbsvc@squirrel-4f5a6.iam.gserviceaccount.com",
        privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCktSm3tJJ3+0cb\na0um0DUnPJANw0gie6e6XqfqnLsl63aM19ssFQGv2yC83NDJguRUhfRFUWaZStb2\ninAjmUVh66XmxrrtxSx1ow6MJTYyYqfVNE9M+haQe4ccwt1RPo1w23N0GPzN7anz\nJRNQmek7Edt334EUd6Pgr14J4xS4bgkYoAaRwFGihMMZZTBByf9MD2o33l1tF3rD\nqJklBt7eBDL5MVU213O6865Ehd5XBAJWsMSQlFSeDWPKdc3oeHMUQvt9hR8UNA3l\nt0wKIOLEcgCg7Hunc2NQ8msAD6zu2ajRRNdxd6GORurhRaZGZxITldXZRgnHOYY+\nRLgHR2qdAgMBAAECggEAB7CUmMjTsMnYxUkyYECmxqTvddEI+GEtEMi0DsJQA4J1\nh7hZOXrmmAMDSYYGsm3Lwr15TNYy09PYauzGNQdGI774gSiEmC7FN13MQ1NGbz5H\nZy8Yx7eCX68AvSFE63Lf8CWyw3gaL3QZ4+n2d6Qj7TfVdwiGkoHOcyJE4fHJ6R1Y\n3nuubd7rVuBXllbjD2AvK9/KaKrqoYB825gF9eK1lN5Gvwyea3H9XEq7RC83eJhx\nbqUSjXNbwXu0xeR8VvvAwpqBmvgSHyHWo3l3ERF/ayjqLF90IcPye9Zp1yoOIdez\neWcuEdUqYC/Dtiwl7747UCZ9xU1EnNuaqKhAVp/qaQKBgQDRLp5b56czhOtExXfc\nrITL+QjbfqWJAUr3IKg2irZjDMdDIyJHd8qXEKGgisCgBFXHH51HBjkOqvkwAFaV\n7TetZ9Q+o78LFm72hDqL83zhJO/euohb95fuJZAdQgY/3hwiNC7z7ubtkQ7oKOtq\nxEnqLe0DHcNsIvQOh+BKpor7ZQKBgQDJklG+R602JSgAlQWpPG/4peFH9zaBAw8P\n5ccW9F4fxvV5xpd5q9szcjwree8bErQV7ySgJ9329dJ7O52OqbuTK/CM6VzmsIcX\npcA5bHTnJnTH1E70pJOWfKd14AOriAWEAt/Xlh+mzZRjMYOTY3pLHB9Cp4K04/yM\n68zdaxbq2QKBgHCDxdQjZ1ET1sR3/r/o38kjG7uMhJeL5XnFzBUCSZY/glK/bCnK\n6mKVJIrI91Fa45SmkZ9pXnlgR4alN+2O2hrgtU44H4NkPq1EdIVgo7QqfQdth/kH\n1WXYOIs0P05NNw7CyNqWjwoLs1v23qHgEO3wZAMAGGRq7KGAPomIyUrtAoGBAMMC\n2Cqq1ZzIncbSZcOxQPLiKO2i8gwmlW/f8Zj3mghMSDkkNG/2H//JyQSW1wjuM2P1\nFQ4NA+VlNdkbd/cJpvtfSz5IlyRoLIpoRWxIzWDEB788W5a7kj3JI4oay/IrioqI\n7V55Uu3hfmnpAU6asznvXx7xSLcQysjbaDve2zEhAoGATBR5kfTTHbFaoEeLXjDj\nBaRJJq9ywcAt/8B0SOgBDQjsRExoZKF0sNxVyMUDQkbNys9Fali5+A+jst9bbJZ+\nnSisUU0OXbWS2YCN2J/wxv/TTgpv7dK2zji5ZLLIZOJ3PXToQhJ6wQq367AUma9l\nEJoCaCIoAdcf2he+gqec+sM=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
      }),
      databaseURL: "https://squirrel-4f5a6-default-rtdb.firebaseio.com"
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

export const adminDb = getFirestore();
export const adminMessaging = getMessaging();
export const adminAuth = getAuth();
export const adminRtdb = getDatabase();
