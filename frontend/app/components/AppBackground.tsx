import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Path } from 'react-native-svg';

export default function AppBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="52%" stopColor="#F4F5F7" />
            <Stop offset="100%" stopColor="#E6E9EE" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bgGrad)" />
        <Path d="M0 92 H1200" stroke="#E21A12" strokeOpacity={0.08} strokeWidth="16" />
        <Path d="M-140 820 L560 120 L720 120 L20 820 Z" fill="#111317" opacity={0.035} />
        <Path d="M280 0 L1200 0 L1200 70 L350 70 Z" fill="#E21A12" opacity={0.07} />
      </Svg>
    </View>
  );
}
