// src/components/meetings/components/TabPanel.jsx
import { Box } from '@mui/material';

export const TabPanel = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index} style={{ padding: value === index ? 0 : undefined }}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);