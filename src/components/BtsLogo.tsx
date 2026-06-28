import React from 'react';

interface BtsLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
}

export const BtsLogo: React.FC<BtsLogoProps> = ({ 
  className = '', 
  size = '100%', 
  showText = true 
}) => {
  const sizeStyle = typeof size === 'number' ? { width: size, height: size } : { width: size, height: size };

  return (
    <div 
      style={sizeStyle} 
      className={`relative overflow-hidden select-none flex items-center justify-center ${className}`}
    >
      <img 
        src="/src/assets/images/bts_logo_black_1782652992299.jpg" 
        alt="BTS eSports Logo" 
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain mix-blend-screen filter contrast-[1.05] brightness-[1.05]"
      />
    </div>
  );
};
