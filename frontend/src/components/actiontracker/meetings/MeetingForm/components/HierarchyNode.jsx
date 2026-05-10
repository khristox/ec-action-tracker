// src/components/meetings/MeetingForm/components/HierarchyNode.jsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import api from '../../../../../services/api';
import { getLevelInfo, hexAlpha } from '../utils';
import { ADDRESS_LEVELS, BUILDING_LEVELS } from '../constants';

export const HierarchyNode = React.memo(({ 
  node, 
  depth, 
  locationMode, 
  onSelect, 
  selectedId,
  expandedNodes = {},
  onToggleExpand
}) => {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const levelInfo = getLevelInfo(node, ADDRESS_LEVELS, BUILDING_LEVELS);
  const isSelected = selectedId === node.id;
  
  // Check if this node should be expanded based on parent state
  const shouldBeOpen = expandedNodes[node.id] || isOpen;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    
    const newOpenState = !shouldBeOpen;
    setIsOpen(newOpenState);
    
    // Notify parent about expand/collapse
    if (onToggleExpand) {
      onToggleExpand(node.id, newOpenState);
    }
    
    // Load children if opening and not loaded yet
    if (newOpenState && !childrenLoaded) {
      setLoadingChildren(true);
      try {
        const params = new URLSearchParams({
          skip: 0,
          limit: 100,
          location_mode: locationMode,
          parent_id: node.id,
          include_inactive: false,
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        setChildren(items);
        setChildrenLoaded(true);
      } catch (err) {
        console.error('Error loading children:', err);
      } finally {
        setLoadingChildren(false);
      }
    }
  }, [shouldBeOpen, childrenLoaded, locationMode, node.id, onToggleExpand]);

  const maxLevel = locationMode === 'buildings' ? 14 : 7;
  const mightHaveChildren = node.level < maxLevel;

  // Determine if this node has children (based on API response or level)
  const hasChildren = mightHaveChildren && (children.length > 0 || node.has_children);

  return (
    <Box>
      <ListItemButton
        onClick={() => onSelect(node)}
        selected={isSelected}
        sx={{
          borderRadius: 1,
          mb: 0.25,
          pl: 1 + depth * 2,
          pr: 1,
          minHeight: 40,
          '&.Mui-selected': {
            bgcolor: levelInfo ? hexAlpha(levelInfo.color, 0.12) : hexAlpha('#1976d2', 0.12),
            '&:hover': {
              bgcolor: levelInfo ? hexAlpha(levelInfo.color, 0.18) : hexAlpha('#1976d2', 0.18)
            }
          },
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        {hasChildren && (
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{
              mr: 0.5,
              p: 0.25,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          >
            {loadingChildren ? (
              <CircularProgress size={14} />
            ) : shouldBeOpen ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
        )}
        
        {/* Icon with color based on level */}
        <Box
          sx={{
            color: levelInfo?.color || 'text.secondary',
            display: 'flex',
            mr: 1,
            fontSize: 18,
            minWidth: 24
          }}
        >
          {levelInfo?.icon || <LocationIcon fontSize="small" />}
        </Box>
        
        <ListItemText
          primary={
            <Typography
              variant="body2"
              fontWeight={isSelected ? 700 : 400}
              noWrap
              sx={{ flex: 1 }}
            >
              {node.name}
            </Typography>
          }
          secondary={
            <Typography
              variant="caption"
              color="text.disabled"
              noWrap
              sx={{ display: 'block' }}
            >
              {node.code} · {levelInfo?.name || `Level ${node.level}`}
            </Typography>
          }
          secondaryTypographyProps={{ component: 'div' }}
        />
        
        {isSelected && (
          <Chip
            label="Selected"
            size="small"
            color="success"
            sx={{ ml: 1, fontWeight: 600, height: 20, fontSize: '0.7rem' }}
          />
        )}
      </ListItemButton>
      
      {/* Children rendering with animation */}
      {hasChildren && shouldBeOpen && childrenLoaded && children.length > 0 && (
        <Box
          sx={{
            ml: 2,
            borderLeft: 1,
            borderColor: 'divider',
            pl: 1,
            animation: 'fadeIn 0.2s ease-in-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(-10px)' },
              to: { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          {children.map(child => (
            <HierarchyNode
              key={child.id}
              node={child}
              depth={depth + 1}
              locationMode={locationMode}
              onSelect={onSelect}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </Box>
      )}
      
      {/* Show message when no children found */}
      {hasChildren && shouldBeOpen && childrenLoaded && children.length === 0 && (
        <Box
          sx={{
            ml: 4 + depth * 2,
            pl: 3,
            py: 1,
            color: 'text.secondary',
            fontSize: '0.75rem',
            borderLeft: 1,
            borderColor: 'divider'
          }}
        >
          No sub-locations found
        </Box>
      )}
    </Box>
  );
});

HierarchyNode.displayName = 'HierarchyNode';