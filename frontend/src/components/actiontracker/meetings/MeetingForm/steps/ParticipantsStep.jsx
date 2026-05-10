// src/components/meetings/MeetingForm/steps/ParticipantsStep.jsx
import React, { useState } from 'react';
import {
  Stack, Card, CardContent, Box, Typography, Button, List, Divider,
  FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { PersonAdd as PersonAddIcon, EditNote as SecretaryIcon } from '@mui/icons-material';
import { ExistingUsersSelector } from '../components/ExistingUsersSelector';
import { ManualParticipantEntry } from '../components/ManualParticipantEntry';
import { ParticipantListsSelector } from '../components/ParticipantListsSelector';
import { ParticipantItem } from '../components/ParticipantItem';
import { PARTICIPANT_TABS } from '../constants';

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
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={participantTab}
              onChange={(_, val) => setParticipantTab(val)}
              variant="fullWidth"
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

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              👤 Added Participants ({meetingParticipants.length})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowAddParticipantDialog(true)}
              disabled={apiLoading}
            >
              Add More
            </Button>
          </Box>

          {meetingParticipants.length === 0 ? (
            <Alert severity="info" variant="outlined">
              No participants added yet. Use the options above to add participants.
            </Alert>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {meetingParticipants.map(p => (
                <React.Fragment key={p.id}>
                  <ParticipantItem
                    participant={p}
                    onRemove={handleRemoveParticipant}
                    onMakeChairperson={handleSetChairperson}
                    isChairperson={p.is_chairperson}
                    isSecretary={p.name === formData.secretary_name}
                    showActions={!apiLoading}
                  />
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <SecretaryIcon color="secondary" />
            <Typography variant="subtitle1" fontWeight="bold">Designate Secretary</Typography>
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Select Secretary from Participants</InputLabel>
            <Select
              name="secretary_name"
              value={formData.secretary_name}
              onChange={handleChange}
              label="Select Secretary from Participants"
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
      <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Participant</DialogTitle>
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