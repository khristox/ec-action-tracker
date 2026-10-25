// src/components/meetings/components/TabManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Chip,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Tooltip,
  useTheme,
  alpha,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Home as HomeIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  Restore as RestoreIcon,
  Info as InfoIcon // Added missing import
} from '@mui/icons-material';

const STORAGE_KEY = 'meeting_detail_tabs_config';
const OVERVIEW_TAB_ID = 'overview';

// ==================== SORTABLE TAB ITEM ====================
const SortableTabItem = ({ 
  tab, 
  isActive, 
  onSelect, 
  onEdit, 
  onDelete, 
  onTogglePin,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  index,
  isDragging
}) => {
  const theme = useTheme();
  const isPinned = tab.pinned;
  const isOverview = tab.id === OVERVIEW_TAB_ID;

  return (
    <Box
      draggable={!isOverview}
      onDragStart={(e) => {
        if (!isOverview) {
          onDragStart(e, index);
        } else {
          e.preventDefault();
        }
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isOverview) {
          onDragOver(e, index);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!isOverview) {
          onDrop(e, index);
        }
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        cursor: isOverview ? 'default' : 'grab',
        opacity: isDragging ? 0.3 : 1,
        transition: 'opacity 0.2s',
        '&:hover .tab-controls': {
          display: 'flex'
        }
      }}
    >
      <Box
        onClick={() => onSelect(tab.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          borderRadius: 2,
          transition: 'all 0.2s',
          bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
          border: isActive ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}` : '1px solid transparent',
          '&:hover': {
            bgcolor: isActive ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.action.hover, 0.5)
          }
        }}
      >
        {!isOverview && (
          <DragIcon 
            sx={{ 
              fontSize: 16, 
              color: 'text.secondary', 
              opacity: 0.3,
              cursor: 'grab'
            }} 
          />
        )}
        {isOverview && (
          <HomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        )}
        {/* Use tab.icon if provided, otherwise just show text */}
        {tab.icon && !isOverview && (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
            {tab.icon}
          </Box>
        )}
        <Typography
          variant="body2"
          sx={{
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'primary.main' : 'text.primary',
            whiteSpace: 'nowrap',
            fontSize: '0.8125rem'
          }}
        >
          {tab.label}
        </Typography>
        {tab.count > 0 && (
          <Chip
            label={tab.count}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              bgcolor: isActive ? 'primary.main' : 'action.hover',
              color: isActive ? 'white' : 'text.secondary',
              '& .MuiChip-label': { px: 0.75 }
            }}
          />
        )}
        {isPinned && !isOverview && (
          <PushPinIcon sx={{ fontSize: 12, color: 'primary.main', opacity: 0.6 }} />
        )}
      </Box>

      {/* Tab Controls - Show on hover */}
      <Box
        className="tab-controls"
        sx={{
          position: 'absolute',
          right: -32,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'none',
          alignItems: 'center',
          gap: 0.25,
          bgcolor: 'background.paper',
          borderRadius: 1.5,
          boxShadow: 2,
          p: 0.25,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          zIndex: 10
        }}
      >
        {!isOverview && (
          <>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onEdit(tab); }}
              sx={{ p: 0.25 }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onTogglePin(tab.id); }}
              sx={{ p: 0.25 }}
            >
              {isPinned ? <PushPinOutlinedIcon sx={{ fontSize: 14 }} /> : <PushPinIcon sx={{ fontSize: 14 }} />}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
              sx={{ p: 0.25, color: 'error.main' }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </>
        )}
      </Box>
    </Box>
  );
};

// ==================== MAIN TAB MANAGER ====================
const TabManager = ({
  defaultTabs,
  currentTab,
  onTabChange,
  onTabConfigChange,
  children,
  renderTabContent,
  isLoading = false
}) => {
  const theme = useTheme();
  
  // State
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure overview tab exists and is first
        const hasOverview = parsed.some(t => t.id === OVERVIEW_TAB_ID);
        if (!hasOverview) {
          return [defaultTabs[0], ...parsed];
        }
        // Move overview to first position if not already
        const overviewIndex = parsed.findIndex(t => t.id === OVERVIEW_TAB_ID);
        if (overviewIndex > 0) {
          const overview = parsed.splice(overviewIndex, 1)[0];
          parsed.unshift(overview);
        }
        return parsed;
      } catch {
        return defaultTabs;
      }
    }
    return defaultTabs;
  });

  const [activeTab, setActiveTab] = useState(currentTab || tabs[0]?.id || OVERVIEW_TAB_ID);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedTab, setSelectedTab] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTabName, setEditTabName] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Save tabs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    if (onTabConfigChange) {
      onTabConfigChange(tabs);
    }
  }, [tabs, onTabConfigChange]);

  // Sync active tab with prop
  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  // ==================== DRAG AND DROP HANDLERS ====================
  const handleDragStart = (e, index) => {
    // Don't allow dragging overview tab
    if (tabs[index].id === OVERVIEW_TAB_ID) return;
    
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add visual feedback
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
    if (e.target) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Don't allow dropping on overview tab
    if (tabs[index].id === OVERVIEW_TAB_ID) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;
    
    // Don't allow moving the overview tab or dropping onto it
    if (tabs[dragIndex].id === OVERVIEW_TAB_ID || tabs[dropIndex].id === OVERVIEW_TAB_ID) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setIsDragging(false);
      return;
    }

    // Reorder tabs
    const newTabs = [...tabs];
    const [removed] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, removed);
    setTabs(newTabs);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  // ==================== TAB MANAGEMENT HANDLERS ====================
  const handleEditTab = (tab) => {
    setMenuAnchor(null);
    setSelectedTab(tab);
    setEditTabName(tab.label);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editTabName.trim()) {
      setTabs(tabs.map(tab =>
        tab.id === selectedTab.id
          ? { ...tab, label: editTabName.trim() }
          : tab
      ));
    }
    setEditDialogOpen(false);
    setSelectedTab(null);
    setEditTabName('');
  };

  const handleDeleteTab = (tabId) => {
    if (tabId === OVERVIEW_TAB_ID) return;
    
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    
    if (activeTab === tabId) {
      setActiveTab(OVERVIEW_TAB_ID);
      if (onTabChange) onTabChange(OVERVIEW_TAB_ID);
    }
  };

  const handleAddTab = () => {
    setMenuAnchor(null);
    setAddDialogOpen(true);
    setNewTabName('');
  };

  const handleSaveNewTab = () => {
    if (newTabName.trim()) {
      const newTab = {
        id: `tab-${Date.now()}`,
        label: newTabName.trim(),
        count: 0,
        pinned: false,
        custom: true
      };
      setTabs([...tabs, newTab]);
    }
    setAddDialogOpen(false);
    setNewTabName('');
  };

  const handleTogglePin = (tabId) => {
    if (tabId === OVERVIEW_TAB_ID) return;
    setTabs(tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, pinned: !tab.pinned }
        : tab
    ));
  };

  const handleResetTabs = () => {
    setTabs(defaultTabs);
    setActiveTab(OVERVIEW_TAB_ID);
    if (onTabChange) onTabChange(OVERVIEW_TAB_ID);
  };

  // Menu handlers
  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: 'visible',
          mb: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: 'background.paper',
          position: 'relative',
          p: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Tabs Container with Drag/Drop */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              overflowX: 'auto',
              py: 0.5,
              px: 1,
              flex: 1,
              '&::-webkit-scrollbar': {
                height: 3
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'divider',
                borderRadius: 2
              }
            }}
          >
            {tabs.map((tab, index) => (
              <Box
                key={tab.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                sx={{
                  position: 'relative',
                  ...(dragOverIndex === index && draggedIndex !== null && tab.id !== OVERVIEW_TAB_ID && {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: -4,
                      top: '15%',
                      height: '70%',
                      width: 2,
                      bgcolor: 'primary.main',
                      borderRadius: 1,
                      animation: 'pulse 1s ease-in-out infinite'
                    }
                  }),
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 }
                  }
                }}
              >
                <SortableTabItem
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onSelect={handleTabChange}
                  onEdit={handleEditTab}
                  onDelete={handleDeleteTab}
                  onTogglePin={handleTogglePin}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  index={index}
                  isDragging={isDragging && draggedIndex === index}
                />
              </Box>
            ))}

            {/* Add Tab Button */}
            <Tooltip title="Add New Tab">
              <IconButton
                size="small"
                onClick={handleAddTab}
                sx={{
                  ml: 0.5,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  minWidth: 32,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    borderColor: 'primary.main'
                  }
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Tab Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
            <Tooltip title="Reset Tabs to Default">
              <IconButton
                size="small"
                onClick={handleResetTabs}
                sx={{
                  opacity: 0.6,
                  '&:hover': { opacity: 1 }
                }}
              >
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Tab Settings">
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                sx={{
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                <MoreIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
      >
        <MenuItem onClick={() => { handleAddTab(); handleMenuClose(); }}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add New Tab</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleResetTabs}>
          <ListItemIcon>
            <RestoreIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset to Default Tabs</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ opacity: 0.6 }}>
          <ListItemText secondary="Drag tabs to reorder • Hover for options" />
        </MenuItem>
      </Menu>

      {/* Edit Tab Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tab Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tab Name"
            fullWidth
            value={editTabName}
            onChange={(e) => setEditTabName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={!editTabName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Tab Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Tab</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tab Name"
            fullWidth
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSaveNewTab()}
            helperText="Enter a name for the new custom tab"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNewTab} variant="contained" disabled={!newTabName.trim()}>
            Add Tab
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tab Content */}
      <Box sx={{ mt: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          renderTabContent ? renderTabContent(activeTab, tabs) : children
        )}
      </Box>
    </Box>
  );
};

export default TabManager;