import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID!,
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID!,
});

/** Register a new user. Does NOT sign them in — they must confirm first. */
export function signUp(
  email: string,
  password: string,
  attributes: { given_name: string; family_name: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attrList = [
      new CognitoUserAttribute({ Name: 'given_name', Value: attributes.given_name }),
      new CognitoUserAttribute({ Name: 'family_name', Value: attributes.family_name }),
    ];
    userPool.signUp(email, password, attrList, [], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/** Submit the email confirmation code sent after signUp. */
export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/** Sign in and return the ID token JWT string. */
export function signIn(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) =>
        resolve(session.getIdToken().getJwtToken()),
      onFailure: reject,
    });
  });
}

/** Sign out the current user locally (clears the session from localStorage). */
export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

/**
 * Returns the current user's ID token JWT string, refreshing if needed.
 * Returns null if no user is signed in or the session cannot be refreshed.
 */
export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}
