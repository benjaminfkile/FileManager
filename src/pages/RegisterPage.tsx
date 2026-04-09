import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { registerUser } from '../api/userService';
import { useAuth } from '../contexts/AuthContext';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MIN_API_KEY_LENGTH = 12;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (!USERNAME_REGEX.test(username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    if (!apiKey) {
      errors.apiKey = 'API key is required';
    } else if (apiKey.length < MIN_API_KEY_LENGTH) {
      errors.apiKey = `API key must be at least ${MIN_API_KEY_LENGTH} characters`;
    }
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        api_key: apiKey,
      });
      await login(apiKey);
      navigate('/');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { errorMsg?: string } } };
      const message = axiosError.response?.data?.errorMsg ?? 'Registration failed';
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
            File Manager
          </Typography>

          {apiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
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
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={!!fieldErrors.username}
              helperText={fieldErrors.username}
              fullWidth
              margin="normal"
            />
            <TextField
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              error={!!fieldErrors.apiKey}
              helperText={fieldErrors.apiKey}
              fullWidth
              margin="normal"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle api key visibility"
                        onClick={() => setShowApiKey((prev) => !prev)}
                        edge="end"
                      >
                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{ mt: 2 }}
            >
              {submitting ? 'Registering...' : 'Register'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
