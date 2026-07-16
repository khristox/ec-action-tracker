// src/components/meetings/MeetingForm/steps/ParticipantsStep.jsx
import React, { useState } from 'react';
import {
  Stack, Card, CardContent, Box, Typography, Button, List, Divider,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  PersonAdd as PersonAdd, 
  EditNote as SecretaryIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  ListAlt as ListIcon
} from '@mui/icons-material';
import { ExistingUsersSelector } from '../components/ExistingUsersSelector';
import { ManualParticipantEntry } from '../components/ManualParticipantEntry';
import { ParticipantListsSelector } from '../components/ParticipantListsSelector';
import { ParticipantItem } from '../components/ParticipantItem';

// Updated tab configuration with short, meaningful names
const PARTICIPANT_TABS = [
  { 
    value: 'existing', 
    label: 'Users', 
    icon: <PeopleIcon />, 
    description: 'Add existing system users'
  },
  { 
    value: 'manual', 
    label: 'Manual', 
    icon: <PersonIcon />, 
    description: 'Add external participants'
  },
  { 
    value: 'lists', 
    label: 'Groups', 
    icon: <ListIcon />, 
    description: 'Add from saved participant lists'
  }
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
  apiLoading
}) => {
  const [participantTab, setParticipantTab] = useState('existing');
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);

  return (
    <Stack spacing={3}>
      {/* Main Participants Card */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={participantTab}
              onChange={(_, val) => setParticipantTab(val)}
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }
              }}
            >
              {PARTICIPANT_TABS.map(tab => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Box>

          {participantTab === 'existing' && (
            <ExistingUsersSelector
              onAddUser={handleAddExistingUser}
              existingParticipants={meetingParticipants}
              selectedUserIds={selectedUserIds}
            />
          )}

          {participantTab === 'manual' && (
            <ManualParticipantEntry
              onAddParticipant={handleAddManualParticipant}
            />
          )}

          {participantTab === 'lists' && (
            <ParticipantListsSelector
              onAddFromList={handleAddFromList}
              selectedParticipantIds={selectedParticipantIds}
            />
          )}
        </CardContent>
      </Card>

      {/* Added Participants List */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              👤 Participants ({meetingParticipants.length})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={() => setShowAddParticipantDialog(true)}
              disabled={apiLoading}
              size="small"
            >
              Add More
            </Button>
          </Box>

          {meetingParticipants.length === 0 ? (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
              No participants added. Use <strong>Users</strong>, <strong>Manual</strong>, or <strong>Groups</strong> to add.
            </Alert>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {meetingParticipants.map((p, index) => (
                <React.Fragment key={p.id}>
                  <ParticipantItem
                    participant={p}
                    onRemove={handleRemoveParticipant}
                    onMakeChairperson={handleSetChairperson}
                    isChairperson={p.is_chairperson}
                    isSecretary={p.name === formData.secretary_name}
                    showActions={!apiLoading}
                  />
                  {index < meetingParticipants.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Secretary Selection */}
      <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <SecretaryIcon color="secondary" />
            <Typography variant="subtitle1" fontWeight="bold">Secretary</Typography>
            <Typography variant="caption" color="text.secondary">
              {meetingParticipants.length === 0 ? '(No participants available)' : ''}
            </Typography>
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Select Secretary</InputLabel>
            <Select
              name="secretary_name"
              value={formData.secretary_name || ''}
              onChange={handleChange}
              label="Select Secretary"
              disabled={apiLoading || meetingParticipants.length === 0}
            >
              <MenuItem value=""><em>None Selected</em></MenuItem>
              {meetingParticipants.map(p => (
                <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Add Participant Dialog */}
      <Dialog 
        open={showAddParticipantDialog} 
        onClose={() => setShowAddParticipantDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonAdd color="primary" />
            <Typography variant="h6" fontWeight={700}>Add Participant</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Tabs
              value={participantTab}
              onChange={(_, val) => setParticipantTab(val)}
              variant="fullWidth"
              sx={{ mb: 2 }}
            >
              {PARTICIPANT_TABS.map(tab => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>

            {participantTab === 'existing' && (
              <ExistingUsersSelector
                onAddUser={(user) => {
                  handleAddExistingUser(user);
                  setShowAddParticipantDialog(false);
                }}
                existingParticipants={meetingParticipants}
                selectedUserIds={selectedUserIds}
              />
            )}

            {participantTab === 'manual' && (
              <ManualParticipantEntry
                onAddParticipant={(participant) => {
                  handleAddManualParticipant(participant);
                  setShowAddParticipantDialog(false);
                }}
              />
            )}

            {participantTab === 'lists' && (
              <ParticipantListsSelector
                onAddFromList={(participants) => {
                  handleAddFromList(participants);
                  setShowAddParticipantDialog(false);
                }}
                selectedParticipantIds={selectedParticipantIds}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddParticipantDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ParticipantsStep;