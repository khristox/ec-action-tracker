// src/components/actiontracker/meetings/components/StatusChip.jsx
import { Chip } from '@mui/material';
import PendingIcon from '@mui/icons-material/Pending';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { getStatusConfig } from '../utils/helpers';

// Map icon names to components
const iconMap = {
  PendingIcon: PendingIcon,
  PlayCircleIcon: PlayCircleIcon,
  StopCircleIcon: StopCircleIcon,
  CheckCircleIcon: CheckCircleIcon,
  Cancel: Cancel,
  ScheduleOutlinedIcon: ScheduleOutlinedIcon,
  AccessTimeIcon: AccessTimeIcon,
};

export const StatusChip = ({ status, size = 'small', sx = {} }) => {
  const config = getStatusConfig(status);
  const IconComponent = iconMap[config.iconName];
  
  return (
    <Chip 
      label={config.label}
      size={size}
      icon={IconComponent ? <IconComponent sx={{ fontSize: 14 }} /> : undefined}
      sx={{ 
        bgcolor: config.bgColor,
        color: config.color, 
        fontWeight: 700,
        borderRadius: 1.5,
        height: size === 'small' ? 28 : 32,
        ...sx
      }}
    />
  );
};