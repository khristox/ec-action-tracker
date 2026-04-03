import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Typography, Paper, List, ListItem, ListItemText, Chip, CircularProgress, Box } from '@mui/material';
import { fetchMyTasks } from '../../../store/slices/actionTracker/actionSlice';

const MyTasks = () => {
  const dispatch = useDispatch();
  const { myTasks, loading } = useSelector((state) => state.actions);

  useEffect(() => {
    dispatch(fetchMyTasks());
  }, [dispatch]);

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh"><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>My Tasks</Typography>
      <Paper sx={{ p: 3 }}>
        {myTasks.length === 0 ? (
          <Typography textAlign="center" color="text.secondary">No tasks assigned to you.</Typography>
        ) : (
          <List>
            {myTasks.map((task) => (
              <ListItem key={task.id} divider>
                <ListItemText primary={task.description} secondary={`Due: ${new Date(task.due_date).toLocaleDateString()}`} />
                <Chip label={`${task.overall_progress_percentage}%`} color={task.overall_progress_percentage === 100 ? 'success' : 'warning'} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default MyTasks;