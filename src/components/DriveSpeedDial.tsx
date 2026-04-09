import React, { useState } from 'react';
import {
  SpeedDial,
  SpeedDialAction,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import {
  Add,
  UploadFile,
  CreateNewFolder,
  Close,
} from '@mui/icons-material';
import { IFolder, IFile } from '../types';
import FileUpload from './FileUpload';
import CreateFolderDialog from './CreateFolderDialog';

export interface DriveSpeedDialProps {
  folderId: string | null;
  onFolderCreated: (f: IFolder) => void;
  onFileUploaded: (f: IFile) => void;
}

export default function DriveSpeedDial({
  folderId,
  onFolderCreated,
  onFileUploaded,
}: DriveSpeedDialProps) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const actions = [
    {
      icon: <UploadFile />,
      name: 'Upload file',
      onClick: () => {
        setOpen(false);
        setUploadOpen(true);
      },
    },
    {
      icon: <CreateNewFolder />,
      name: 'New folder',
      onClick: () => {
        setOpen(false);
        setCreateOpen(true);
      },
    },
  ];

  return (
    <>
      <SpeedDial
        ariaLabel="file actions"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        icon={<Add />}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            title={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>

      {/* Upload File Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
          Upload File
          <IconButton
            aria-label="close"
            onClick={() => setUploadOpen(false)}
            sx={{ ml: 'auto' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FileUpload
            folderId={folderId}
            onUploaded={(file) => {
              setUploadOpen(false);
              onFileUploaded(file);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createOpen}
        parentFolderId={folderId}
        onClose={() => setCreateOpen(false)}
        onCreated={(folder) => {
          onFolderCreated(folder);
        }}
      />
    </>
  );
}
