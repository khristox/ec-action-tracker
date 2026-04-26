// src/components/AuthenticatedImage.jsx
import { useEffect, useState } from 'react';
import { Avatar, Skeleton } from '@mui/material';

const AuthenticatedImage = ({ 
  userId, 
  token, 
  size = 100,
  fallbackInitials = 'U',
  sx = {},
  ...props 
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    setLoading(true);
    setImageUrl(null);
    setHasImage(false);

    let currentBlobUrl = null;

    const fetchImage = async () => {
      if (!userId || !token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8001/api/v1/auth/${userId}/profile-picture`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          currentBlobUrl = url;
          setImageUrl(url);
          setHasImage(true);
        } else if (response.status === 404) {
          setHasImage(false);
        } else {
          console.error('Failed to load profile picture:', response.status);
          setHasImage(false);
        }
      } catch (error) {
        console.error('Error loading profile picture:', error);
        setHasImage(false);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [userId, token]);

  if (loading) {
    return <Skeleton variant="circular" width={size} height={size} sx={sx} />;
  }

  if (hasImage && imageUrl) {
    return (
      <Avatar
        src={imageUrl}
        sx={{ width: size, height: size, ...sx }}
        {...props}
      />
    );
  }

  // Fallback to avatar with initials
  return (
    <Avatar
      sx={{ width: size, height: size, bgcolor: 'primary.main', ...sx }}
      {...props}
    >
      {fallbackInitials}
    </Avatar>
  );
};

export default AuthenticatedImage;