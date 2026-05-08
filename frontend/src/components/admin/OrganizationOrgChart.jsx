// components/OrganizationChart.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Card,
  CardContent,
  Typography,
  Tooltip,
  Fab,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountTree as TreeIcon
} from '@mui/icons-material';
import { Tree, TreeNode } from 'react-organizational-chart';
import { JRXFormRenderer } from './JRXFormRenderer';
import { apiService } from '../services/api';

export const OrganizationChart = () => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create, edit, view
  const [selectedNode, setSelectedNode] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchTree();
    fetchParentOptions();
  }, []);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/organization/tree');
      setTreeData(response.data.data);
    } catch (error) {
      showNotification('Failed to load organization tree', 'error');
    }
    setLoading(false);
  };

  const fetchParentOptions = async () => {
    try {
      const response = await apiService.get('/organization/nodes', {
        params: { include_inactive: false, limit: 1000 }
      });
      const nodes = response.data.data || [];
      setParentOptions(nodes);
    } catch (error) {
      console.error('Failed to fetch parent options:', error);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateNode = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        title: formData.title,
        parent_id: formData.parent_id || null,
        email: formData.email || null,
        phone: formData.phone || null,
        department_code: formData.department_code || null,
        location: formData.location || null,
        employee_count: parseInt(formData.employee_count) || 0,
        budget: parseFloat(formData.budget) || 0,
        color: formData.color || '#4A90E2',
        order: parseInt(formData.order) || 0,
        is_active: formData.is_active !== false,
        additional_metadata: formData.additional_metadata ? JSON.parse(formData.additional_metadata) : {}
      };
      
      await apiService.post('/organization/nodes', payload);
      showNotification('Department created successfully');
      setDialogOpen(false);
      fetchTree();
      fetchParentOptions();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Failed to create department', 'error');
    }
  };

  const handleUpdateNode = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        title: formData.title,
        parent_id: formData.parent_id || null,
        email: formData.email || null,
        phone: formData.phone || null,
        department_code: formData.department_code || null,
        location: formData.location || null,
        employee_count: parseInt(formData.employee_count) || 0,
        budget: parseFloat(formData.budget) || 0,
        color: formData.color,
        order: parseInt(formData.order) || 0,
        is_active: formData.is_active
      };
      
      await apiService.put(`/organization/nodes/${selectedNode.id}`, payload);
      showNotification('Department updated successfully');
      setDialogOpen(false);
      fetchTree();
      fetchParentOptions();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Failed to update department', 'error');
    }
  };

  const handleDeleteNode = async () => {
    if (!window.confirm(`Delete "${selectedNode.name}" and all its sub-departments?`)) return;
    
    try {
      await apiService.delete(`/organization/nodes/${selectedNode.id}`, {
        params: { cascade: true }
      });
      showNotification('Department deleted successfully');
      setDialogOpen(false);
      fetchTree();
      fetchParentOptions();
    } catch (error) {
      showNotification('Failed to delete department', 'error');
    }
  };

  const renderTreeNode = (node) => {
    return (
      <TreeNode
        key={node.id}
        label={
          <Card
            sx={{
              minWidth: 200,
              maxWidth: 250,
              backgroundColor: node.metadata?.color || node.color || '#4A90E2',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 3
              }
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {node.name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {node.title}
              </Typography>
              {node.employee_count > 0 && (
                <Chip
                  label={`👥 ${node.employee_count}`}
                  size="small"
                  sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', mb: 1 }}
                />
              )}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1 }}>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    sx={{ color: 'white' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setDialogMode('edit');
                      setDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Add Child">
                  <IconButton
                    size="small"
                    sx={{ color: 'white' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      setDialogMode('create');
                      setDialogOpen(true);
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    sx={{ color: 'white' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                      handleDeleteNode();
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        }
      >
        {node.children && node.children.map(child => renderTreeNode(child))}
      </TreeNode>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          <TreeIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Organization Chart
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedNode(null);
            setDialogMode('create');
            setDialogOpen(true);
          }}
        >
          Add Root Department
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <Typography>Loading organization tree...</Typography>
        </Box>
      ) : treeData.length === 0 ? (
        <Alert severity="info">
          No departments found. Click "Add Root Department" to get started.
        </Alert>
      ) : (
        <Box sx={{ overflowX: 'auto', p: 2 }}>
          <Tree lineWidth="2px" lineColor="#1890ff" lineBorderRadius="10px">
            {treeData.map(node => renderTreeNode(node))}
          </Tree>
        </Box>
      )}

      {/* Form Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' && (selectedNode ? `Add Child to ${selectedNode.name}` : 'Create Root Department')}
          {dialogMode === 'edit' && `Edit ${selectedNode?.name}`}
        </DialogTitle>
        <DialogContent>
          <JRXFormRenderer
            mode={dialogMode}
            initialData={dialogMode === 'edit' ? {
              ...selectedNode,
              parent_id: selectedNode?.parent_id,
              additional_metadata: selectedNode?.additional_metadata 
                ? JSON.stringify(selectedNode.additional_metadata, null, 2)