// src/components/meetings/MeetingForm/components/ParticipantListsSelector.jsx
import React, { useState, useEffect } from 'react';
import { 
  Stack, FormControl, InputLabel, Select, MenuItem, Paper, 
  List, ListItem, ListItemAvatar, ListItemText, ListItemButton, 
  Checkbox, Avatar, Box, Typography, Button, CircularProgress 
} from '@mui/material';
import { GroupAdd as GroupAddIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchParticipantLists, 
  fetchParticipantList, 
  selectParticipantLists, 
  selectCurrentList,
  selectListsLoading
} from '../../../../../store/slices/actionTracker/participantSlice';

export const ParticipantListsSelector = ({ onAddFromList, selectedParticipantIds }) => {
  const [selectedListId, setSelectedListId] = useState('');
  const [checkedIds, setCheckedIds] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const dispatch = useDispatch();
  const participantLists = useSelector(selectParticipantLists);
  const currentList = useSelector(selectCurrentList);
  const listsLoading = useSelector(selectListsLoading);

  // Load the list of lists on mount
  useEffect(() => {
    dispatch(fetchParticipantLists());
  }, [dispatch]);

  // When a list is selected, fetch its details
  useEffect(() => {
    if (selectedListId) {
      setLoadingDetails(true);
      dispatch(fetchParticipantList(selectedListId))
        .unwrap()
        .then(() => setLoadingDetails(false))
        .catch(() => setLoadingDetails(false));
    }
  }, [selectedListId, dispatch]);

  // Reset checked selections when list changes
  useEffect(() => {
    setCheckedIds([]);
  }, [selectedListId]);

  // Use the detailed list if loaded, otherwise fallback to summary
  const selectedList = currentList?.id === selectedListId ? currentList : null;
  const participants = selectedList?.participants || [];
  
  // Filter out already selected participants
  const availableParticipants = participants.filter(
    p => !selectedParticipantIds.includes(p.id)
  );

  const allChecked = availableParticipants.length > 0 && 
    checkedIds.length === availableParticipants.length;
  const someChecked = checkedIds.length > 0 && !allChecked;

  const handleToggleOne = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (allChecked) {
      setCheckedIds([]);
    } else {
      setCheckedIds(availableParticipants.map(p => p.id));
    }
  };

  const handleAddSelected = () => {
    if (!selectedList || checkedIds.length === 0) return;
    
    const participantsToAdd = availableParticipants
      .filter(p => checkedIds.includes(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        telephone: p.telephone,
        title: p.title,
        organization: p.organization,
        is_chairperson: false,
        from_list: true,
        list_id: selectedList.id,
        list_name: selectedList.name
      }));
    
    onAddFromList(participantsToAdd);
    setCheckedIds([]);
  };

  // Show loading while lists are being fetched
  if (listsLoading && participantLists.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>Select Participant List</InputLabel>
        <Select
          value={selectedListId || ''}
          onChange={(e) => setSelectedListId(e.target.value)}
          label="Select Participant List"
        >
          <MenuItem value="">
            <em>Select a list...</em>
          </MenuItem>
          {participantLists.map(list => (
            <MenuItem key={list.id} value={list.id}>
              {list.name} ({list.participant_count || 0} participants)
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedListId && (
        <>
          {loadingDetails ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={30} />
            </Box>
          ) : selectedList ? (
            <>
              <Paper variant="outlined" sx={{ maxHeight: 250, overflow: 'auto' }}>
                <List dense>
                  {participants.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="This list has no participants" />
                    </ListItem>
                  ) : availableParticipants.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="All participants from this list have been added" />
                    </ListItem>
                  ) : (
                    <>
                      <ListItem disablePadding divider>
                        <ListItemButton onClick={handleToggleAll} dense>
                          <Checkbox
                            edge="start"
                            checked={allChecked}
                            indeterminate={someChecked}
                            tabIndex={-1}
                            disableRipple
                          />
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight={600}>
                                Select All ({availableParticipants.length})
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                      {availableParticipants.map(p => (
                        <ListItem key={p.id} disablePadding>
                          <ListItemButton onClick={() => handleToggleOne(p.id)} dense>
                            <Checkbox
                              edge="start"
                              checked={checkedIds.includes(p.id)}
                              tabIndex={-1}
                              disableRipple
                            />
                            <ListItemAvatar>
                              <Avatar src={p.avatar_url} alt={p.name}>
                                {p.name?.[0]?.toUpperCase() || 'P'}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText 
                              primary={p.name} 
                              secondary={p.email} 
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </>
                  )}
                </List>
              </Paper>
              <Button
                variant="contained"
                onClick={handleAddSelected}
                disabled={checkedIds.length === 0}
                startIcon={<GroupAddIcon />}
                fullWidth
              >
                Add Selected ({checkedIds.length}) Participant
                {checkedIds.length !== 1 ? 's' : ''}
              </Button>
            </>
          ) : (
            <Box p={2} textAlign="center" color="text.secondary">
              <Typography variant="body2">
                No details available for this list
              </Typography>
            </Box>
          )}
        </>
      )}
    </Stack>
  );
};