import { memo } from 'react';
import { Image } from 'react-native';

const officialLogo = require('../../assets/images/gastos-gang-logo.png');

export const BrandLogo = memo(function BrandLogo({
  size = 84,
  accessibilityLabel = 'Gastos Gang',
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessible
      resizeMode="contain"
      source={officialLogo}
      style={{ width: size, height: size }}
    />
  );
});
