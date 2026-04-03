import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Chip,
  Grid,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tab,
  Tabs,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ padding: '24px 0' }}>
    {value === index && children}
  </div>
);

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [newAction, setNewAction] = useState({
    description: '',
    assigned_to_name: '',
    due_date: '',
    priority: 2,
  });

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}`);
      setMeeting(response.data);
    } catch (error) {
      console.error('Error fetching meeting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAction = async () => {
    try {
      const response = await api.post(`/action-tracker/minutes/${meeting.minutes?.[0]?.id}/actions`, newAction);
      setShowAddActionDialog(false);
      fetchMeeting();
    } catch (error) {
      console.error('Error adding action:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) {
    return (
      <Container>
        <Typography>Meeting not found</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {meeting.title}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip label={meeting.status} color="primary" />
              <Chip icon={<ScheduleIcon />} label={new Date(meeting.meeting_date).toLocaleDateString()} variant="outlined" />
              <Chip icon={<LocationIcon />} label={meeting.location_text || 'TBD'} variant="outlined" />
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Button variant="outlined" startIcon={<EditIcon />}>
              Edit
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />}>
              Delete
            </Button>
          </Box>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">Description</Typography>
            <Typography>{meeting.description || 'No description provided'}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">Agenda</Typography>
            <Typography whiteSpace="pre-wrap">{meeting.agenda || 'No agenda provided'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ p: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Participants" />
          <Tab label="Minutes & Actions" />
          <Tab label="Documents" />
        </Tabs>

        {/* Participants Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button startIcon={<AddIcon />} variant="outlined" size="small">
              Add Participant
            </Button>
          </Box>
          <List>
            {meeting.participants?.map((participant) => (
              <ListItem key={participant.id}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: participant.is_chairperson ? '#1976d2' : '#4caf50' }}>
                    {participant.name.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      {participant.name}
                      {participant.is_chairperson && <Chip label="Chairperson" size="small" color="primary" />}
                    </Box>
                  }
                  secondary={`${participant.email || ''} ${participant.telephone || ''}`}
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Minutes & Actions Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setShowAddActionDialog(true)}>
              Add Action Item
            </Button>
          </Box>
          
          {meeting.minutes?.map((minutes) => (
            <Card key={minutes.id} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {minutes.topic}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {minutes.discussion}
                </Typography>
                {minutes.decisions && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Decisions:</Typography>
                    <Typography variant="body2">{minutes.decisions}</Typography>
                  </Alert>
                )}
                
                {/* Action Items */}
                {minutes.actions?.length > 0 && (
                  <Box mt={3}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Action Items
                    </Typography>
                    <List>
                      {minutes.actions.map((action) => (
                        <ListItem key={action.id} sx={{ bgcolor: '#f5f5f5', borderRadius: 1, mb: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: action.completed_at ? '#4caf50' : '#ff9800' }}>
                              {action.completed_at ? <CheckCircleIcon /> : <AssignmentIcon />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={action.description}
                            secondary={`Assigned to: ${action.assigned_to_name} | Due: ${new Date(action.due_date).toLocaleDateString()}`}
                          />
                          <Chip 
                            label={`${action.overall_progress_percentage}%`} 
                            size="small" 
                            color={action.overall_progress_percentage === 100 ? 'success' : 'warning'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </TabPanel>

        {/* Documents Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="body2" color="text.secondary">
            No documents uploaded yet.
          </Typography>
        </TabPanel>
      </Paper>

      {/* Add Action Dialog */}
      <Dialog open={showAddActionDialog} onClose={() => setShowAddActionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Action Item</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Assigned To"
                value={newAction.assigned_to_name}
                onChange={(e) => setNewAction({ ...newAction, assigned_to_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Due Date"
                InputLabelProps={{ shrink: true }}
                value={newAction.due_date}
                onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Priority (1-4)"
                value={newAction.priority}
                onChange={(e) => setNewAction({ ...newAction, priority: parseInt(e.target.value) })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddActionDialog(false)}>Cancel</Button>
          <Button onClick={handleAddAction} variant="contained" disabled={!newAction.description}>
            Add Action
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MeetingDetail;