const CognitoUserPool = jest.fn().mockImplementation(() => ({
  getCurrentUser: jest.fn().mockReturnValue(null),
  signUp: jest.fn(),
}));

const CognitoUser = jest.fn().mockImplementation(() => ({
  authenticateUser: jest.fn(),
  confirmRegistration: jest.fn(),
  forgotPassword: jest.fn(),
  confirmPassword: jest.fn(),
  getSession: jest.fn(),
  signOut: jest.fn(),
}));

const AuthenticationDetails = jest.fn();
const CognitoUserAttribute = jest.fn();
const CognitoUserSession = jest.fn();

export {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
};
