import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { signUp, confirmSignUp, signIn } from '../lib/cognitoClient';
import { registerUser } from '../api/userService';
import { useAuth } from '../contexts/AuthContext';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

type Step = 'signup' | 'confirm';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('signup');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');

  const [confirmationCode, setConfirmationCode] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validateSignUp(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!email.trim()) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (!USERNAME_REGEX.test(username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    return errors;
  }

  function validateConfirm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!confirmationCode.trim()) errors.confirmationCode = 'Confirmation code is required';
    return errors;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');

    const errors = validateSignUp();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signUp(email.trim(), password, {
        given_name: firstName.trim(),
        family_name: lastName.trim(),
      });
      setStep('confirm');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-up failed';
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');

    const errors = validateConfirm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await confirmSignUp(email.trim(), confirmationCode.trim());
      await signIn(email.trim(), password);
      await registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
      });
      await login(email.trim(), password);
      navigate('/');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { errorMsg?: string } } };
      const message =
        axiosError.response?.data?.errorMsg ??
        (err instanceof Error ? err.message : 'Confirmation failed');
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 480 }}>
        <CardContent>
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            {process.env.REACT_APP_PAGE_NAME ?? 'File Manager'}
          </Typography>

          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          {step === 'signup' && (
            <Box component="form" onSubmit={handleSignUp} noValidate>
              <TextField
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={!!fieldErrors.firstName}
                helperText={fieldErrors.firstName}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                error={!!fieldErrors.lastName}
                helperText={fieldErrors.lastName}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!fieldErrors.email}
                helperText={fieldErrors.email}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!fieldErrors.password}
                helperText={fieldErrors.password}
                fullWidth
                margin="normal"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword((prev) => !prev)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={!!fieldErrors.username}
                helperText={fieldErrors.username}
                fullWidth
                margin="normal"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? 'Signing up...' : 'Sign Up'}
              </Button>
            </Box>
          )}

          {step === 'confirm' && (
            <Box component="form" onSubmit={handleConfirm} noValidate>
              <Typography variant="body1" sx={{ mb: 2 }}>
                A confirmation code was sent to <strong>{email}</strong>.
              </Typography>
              <TextField
                label="Confirmation Code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                error={!!fieldErrors.confirmationCode}
                helperText={fieldErrors.confirmationCode}
                fullWidth
                margin="normal"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? 'Confirming...' : 'Confirm'}
              </Button>
            </Box>
          )}

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
