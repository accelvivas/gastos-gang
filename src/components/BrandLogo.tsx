import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

const officialLogo = require('../../assets/images/gg-shaka-logo-transparent.png');

export const BrandLogo = memo(function BrandLogo({
  size = 84,
  accessibilityLabel = 'Gastos Gang',
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        accessibilityLabel={accessibilityLabel}
        accessible
        resizeMode="contain"
        source={officialLogo}
        style={styles.image}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 10 },
  image: { width: '100%', height: '100%' },
});
