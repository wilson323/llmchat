import React from 'react';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
}

interface AvatarFallbackProps {
  className?: string;
  children: React.ReactNode;
}

interface AvatarImageProps {
  src?: string;
  alt?: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({
  children,
  className = '',
}) => {
  return <div className={className}>{children}</div>;
};

export const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  alt,
  className = '',
  onError,
}) => {
  return <img src={src} alt={alt} className={className} onError={onError} />;
};

const AvatarComponent: React.FC<AvatarProps> = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

// Attach subcomponents to main component
const Avatar = AvatarComponent as React.FC<AvatarProps> & {
  Fallback: React.FC<AvatarFallbackProps>;
  Image: React.FC<AvatarImageProps>;
};
Avatar.Fallback = AvatarFallback;
Avatar.Image = AvatarImage;

export default Avatar;