// src/components/meetings/MeetingForm/steps/ParticipantsStep.jsx

import React, { useState } from 'react';
import {
  Stack, Card, Box, Typography, Button, List, Divider,
  FormControl, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, useTheme, alpha, IconButton
} from '@mui/material';
import { 
  PersonAdd as PersonAddIcon, 
  EditNote as SecretaryIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  ListAlt as ListIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Clear as ClearIcon,
  Done as DoneIcon
} from '@mui/icons-material';
import { ExistingUsersSelector } from '../components/ExistingUsersSelector';
import { ManualParticipantEntry } from '../components/ManualParticipantEntry';
import { ParticipantListsSelector } from '../components/ParticipantListsSelector';
import { ParticipantItem } from '../components/ParticipantItem';

const PARTICIPANT_TABS = [
  { value: 'existing', label: 'Users', icon: <PeopleIcon /> },
  { value: 'manual', label: 'Manual', icon: <PersonIcon /> },
  { value: 'lists', label: 'Groups', icon: <ListIcon /> }
];

export const ParticipantsStep = ({
  meetingParticipants,
  selectedUserIds,
  selectedParticipantIds,
  formData,
  handleChange,
  handleAddExistingUser,
  handleAddManualParticipant,
  handleAddFromList,
  handleRemoveParticipant,
  handleSetChairperson,
  apiLoading,
  isMobile
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [participantTab, setParticipantTab] = useState('existing');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Lifted selection state for batch user addition
  const [selectedUsersToBatch, setSelectedUsersToBatch] = useState([]);

  // Get secretary name
  const secretaryName = formData.secretary_name || '';

  // Handler to add batch-selected users from the modal footer
  const handleBatchAddUsers = () => {
    if (selectedUsersToBatch.length === 0) return;

    selectedUsersToBatch.forEach((user) => {
      handleAddExistingUser({
        id: user.id,
        name: user.full_name || user.username,
        email: user.email,
        telephone: user.phone,
        title: user.title,
        organization: user.organization,
        is_chairperson: false,
        is_existing: true
      });
    });

    // Clear selection after adding
    setSelectedUsersToBatch([]);
  };

  const handleClearSelection = () => {
    setSelectedUsersToBatch([]);
  };

  const handleCloseDialog = () => {
    setSelectedUsersToBatch([]);
    setShowAddDialog(false);
  };

  const hasUserSelection = participantTab === 'existing' && selectedUsersToBatch.length > 0;

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      {/* Combined Card: Participant List + Secretary */}
      <Card 
        variant="outlined" 
        sx={{ 
          flex: 1,
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        {/* Header with Add Button */}
        <Box sx={{ 
          p: { xs: 1.5, sm: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          bgcolor: isLight ? alpha(theme.palette.primary.main, 0.02) : 'transparent'
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Participants
            </Typography>
            <Chip 
              label={`${meetingParticipants.length}`} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ height: 20, '& .MuiChip-label': { px: 1, fontSize: '0.7rem' } }}
            />
          </Stack>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowAddDialog(true)}
            disabled={apiLoading}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 2,
              py: 0.5,
              minHeight: 32,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            Add
          </Button>
        </Box>

        {/* Participants List - Scrollable */}
        <Box sx={{ 
          flex: 1,
          overflow: 'auto',
          p: { xs: 1, sm: 1.5 },
          minHeight: 100,
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
            borderRadius: 2,
          },
        }}>
          {meetingParticipants.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              py: 4,
              color: 'text.secondary'
            }}>
              <PeopleIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No participants added yet
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setShowAddDialog(true)}
                sx={{ mt: 1, borderRadius: 2 }}
              >
                Add your first participant
              </Button>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {meetingParticipants.map((p, index) => (
                <React.Fragment key={p.id}>
                  <ParticipantItem
                    participant={p}
                    onRemove={handleRemoveParticipant}
                    onMakeChairperson={handleSetChairperson}
                    isChairperson={p.is_chairperson}
                    isSecretary={p.name === secretaryName}
                    showActions={!apiLoading}
                    isMobile={isMobile}
                  />
                  {index < meetingParticipants.length - 1 && (
                    <Divider sx={{ my: 0.5 }} />
                  )}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {/* Secretary Selection - Compact Footer */}
        <Box sx={{ 
          p: { xs: 1, sm: 1.5 },
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: isLight ? alpha(theme.palette.secondary.main, 0.03) : alpha(theme.palette.secondary.main, 0.05),
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap'
        }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
            <SecretaryIcon color="secondary" sx={{ fontSize: 18 }} />
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Secretary:
            </Typography>
          </Stack>
          
          <FormControl size="small" sx={{ 
            minWidth: { xs: '100%', sm: 180, md: 220 },
            flex: { xs: '1 1 100%', sm: '0 1 auto' }
          }}>
            <Select
              name="secretary_name"
              value={secretaryName}
              onChange={handleChange}
              displayEmpty
              disabled={apiLoading || meetingParticipants.length === 0}
              sx={{ 
                borderRadius: 2,
                height: 32,
                fontSize: '0.8rem',
                bgcolor: isLight ? 'white' : 'transparent',
                '& .MuiSelect-select': { py: 0.5 }
              }}
            >
              <MenuItem value="" sx={{ fontSize: '0.8rem' }}>
                <em>Not assigned</em>
              </MenuItem>
              {meetingParticipants.map(p => (
                <MenuItem key={p.id} value={p.name} sx={{ fontSize: '0.8rem' }}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {meetingParticipants.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ flex: 1 }}>
              Add participants first
            </Typography>
          )}
          
          {secretaryName && (
            <Chip 
              label={secretaryName}
              size="small"
              color="secondary"
              onDelete={() => handleChange({ target: { name: 'secretary_name', value: '' } })}
              sx={{ height: 24 }}
            />
          )}
        </Box>
      </Card>

      {/* Add Participant Dialog */}
      <Dialog 
        open={showAddDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonAddIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Add Participant
            </Typography>
            <Chip 
              label={`${meetingParticipants.length} added`} 
              size="small" 
              variant="outlined"
              sx={{ ml: 1 }}
            />
          </Stack>
          <IconButton 
            size="small" 
            onClick={handleCloseDialog}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Compact Tabs */}
          <Box sx={{ 
            display: 'flex', 
            gap: 0.5, 
            mb: 2,
            bgcolor: isLight ? alpha(theme.palette.primary.main, 0.04) : alpha(theme.palette.primary.main, 0.08),
            borderRadius: 2,
            p: 0.5,
            flexShrink: 0
          }}>
            {PARTICIPANT_TABS.map(tab => (
              <Button
                key={tab.value}
                variant={participantTab === tab.value ? 'contained' : 'text'}
                startIcon={tab.icon}
                onClick={() => {
                  setParticipantTab(tab.value);
                  setSelectedUsersToBatch([]); // Clear selections on tab switch
                }}
                size="small"
                sx={{ 
                  flex: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderRadius: 1.5,
                  py: 0.75,
                  ...(participantTab === tab.value ? {
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  } : {
                    color: 'text.secondary',
                    '&:hover': { bgcolor: 'transparent' }
                  })
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {participantTab === 'existing' && (
              <ExistingUsersSelector
                selectedUserIds={selectedUserIds}
                selectedUsers={selectedUsersToBatch}
                onSelectionChange={setSelectedUsersToBatch}
              />
            )}

            {participantTab === 'manual' && (
              <ManualParticipantEntry
                onAddParticipant={(participant) => {
                  handleAddManualParticipant(participant);
                }}
              />
            )}

            {participantTab === 'lists' && (
              <ParticipantListsSelector
                onAddFromList={(participants) => {
                  handleAddFromList(participants);
                }}
                selectedParticipantIds={selectedParticipantIds}
              />
            )}
          </Box>
        </DialogContent>
        
        {/* Footer: Dynamic swapping between Done and Add [N] Users */}
        <DialogActions sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="caption" color="text.secondary">
            {meetingParticipants.length} participant{meetingParticipants.length !== 1 ? 's' : ''} added
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            {hasUserSelection ? (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearSelection}
                  startIcon={<ClearIcon />}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Clear All
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleBatchAddUsers}
                  startIcon={selectedUsersToBatch.length > 1 ? <PeopleIcon /> : <PersonAddIcon />}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 2 }}
                >
                  Add {selectedUsersToBatch.length} User{selectedUsersToBatch.length !== 1 ? 's' : ''}
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleCloseDialog} 
                variant="contained"
                startIcon={<DoneIcon />}
                size="small"
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
              >
                Done
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default React.memo(ParticipantsStep);