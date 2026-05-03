import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from '@mui/material';
import { forgotPassword, confirmPassword } from '../lib/cognitoClient';
import { useNotification } from '../contexts/NotificationContext';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPwd) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await confirmPassword(email.trim(), code.trim(), newPassword);
      showNotification('Password reset successfully', 'success');
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === 'request' && (
            <Box component="form" onSubmit={handleRequestCode} noValidate>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Enter your email to receive a password reset code.
              </Typography>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                {submitting ? 'Sending...' : 'Send Reset Code'}
              </Button>
            </Box>
          )}

          {step === 'reset' && (
            <Box component="form" onSubmit={handleResetPassword} noValidate>
              <Typography variant="body1" sx={{ mb: 2 }}>
                A reset code was sent to <strong>{email}</strong>.
              </Typography>
              <TextField
                label="Reset Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                fullWidth
                margin="normal"
              />
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
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
                {submitting ? 'Resetting...' : 'Reset Password'}
              </Button>
            </Box>
          )}

          <Button
            variant="text"
            fullWidth
            onClick={() => navigate('/login')}
            sx={{ mt: 2 }}
          >
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
