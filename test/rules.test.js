import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import assert from 'assert';

const PROJECT_ID = 'squirrel-4f5a6';

let testEnv;

before(async () => {
  // We need to replace the placeholders in firestore.rules for testing
  let rules = fs.readFileSync('firestore.rules', 'utf8');
  rules = rules.replace(/REPLACE_WITH_UID_1/g, 'uid_a');
  rules = rules.replace(/REPLACE_WITH_UID_2/g, 'uid_b');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rules,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('User A can read the private conversation', async () => {
    const db = testEnv.authenticatedContext('uid_a').firestore();
    const doc = db.collection('conversations').doc('private-chat');
    await assertSucceeds(doc.get());
  });

  it('User B can read the private conversation', async () => {
    const db = testEnv.authenticatedContext('uid_b').firestore();
    const doc = db.collection('conversations').doc('private-chat');
    await assertSucceeds(doc.get());
  });

  it('Unauthorized user cannot read the private conversation', async () => {
    const db = testEnv.authenticatedContext('hacker').firestore();
    const doc = db.collection('conversations').doc('private-chat');
    await assertFails(doc.get());
  });

  it('Logged out user cannot read', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const doc = db.collection('conversations').doc('private-chat');
    await assertFails(doc.get());
  });

  it('User A can create a message as User A', async () => {
    const db = testEnv.authenticatedContext('uid_a').firestore();
    const message = db.collection('conversations').doc('private-chat').collection('messages').doc();
    await assertSucceeds(message.set({
      text: 'Hello',
      senderId: 'uid_a',
      createdAt: testEnv.firestore.FieldValue.serverTimestamp(),
      seen: false
    }));
  });

  it('User A cannot impersonate User B', async () => {
    const db = testEnv.authenticatedContext('uid_a').firestore();
    const message = db.collection('conversations').doc('private-chat').collection('messages').doc();
    await assertFails(message.set({
      text: 'Hello',
      senderId: 'uid_b',
      createdAt: testEnv.firestore.FieldValue.serverTimestamp(),
      seen: false
    }));
  });

  it('User A cannot update a message to be something else', async () => {
    const dbA = testEnv.authenticatedContext('uid_a').firestore();
    const message = dbA.collection('conversations').doc('private-chat').collection('messages').doc('msg1');
    
    // Setup message
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('conversations').doc('private-chat').collection('messages').doc('msg1').set({
        text: 'Hello',
        senderId: 'uid_a',
        createdAt: new Date(),
        seen: false
      });
    });

    await assertFails(message.update({ text: 'Hacked' }));
  });

  it('User B can mark User A message as seen', async () => {
    const dbB = testEnv.authenticatedContext('uid_b').firestore();
    const message = dbB.collection('conversations').doc('private-chat').collection('messages').doc('msg1');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('conversations').doc('private-chat').collection('messages').doc('msg1').set({
        text: 'Hello',
        senderId: 'uid_a',
        createdAt: new Date(),
        seen: false
      });
    });

    await assertSucceeds(message.update({ seen: true }));
  });

  it('User A cannot mark their own message as seen', async () => {
    const dbA = testEnv.authenticatedContext('uid_a').firestore();
    const message = dbA.collection('conversations').doc('private-chat').collection('messages').doc('msg1');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('conversations').doc('private-chat').collection('messages').doc('msg1').set({
        text: 'Hello',
        senderId: 'uid_a',
        createdAt: new Date(),
        seen: false
      });
    });

    await assertFails(message.update({ seen: true }));
  });
});
