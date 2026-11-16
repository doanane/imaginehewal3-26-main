/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name) => { const C = React.forwardRef((props, ref) => React.createElement(name, { ...props, ref })); C.displayName = name; return C; };
  const flatten = (s) => (Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s || {});
  return {
    View: host('View'), Text: host('Text'), TextInput: host('TextInput'), Pressable: host('Pressable'), TouchableOpacity: host('TouchableOpacity'),
    ScrollView: host('ScrollView'), FlatList: host('FlatList'), ImageBackground: host('ImageBackground'), ActivityIndicator: host('ActivityIndicator'),
    Switch: host('Switch'), KeyboardAvoidingView: host('KeyboardAvoidingView'), RefreshControl: host('RefreshControl'),
    Image: Object.assign(host('Image'), { getSize() {}, prefetch() {}, resolveAssetSource() {} }),
    StatusBar: Object.assign(host('StatusBar'), { setBarStyle() {}, setHidden() {}, currentHeight: 0 }),
    StyleSheet: { create: (x) => x, flatten, absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, hairlineWidth: 1 },
    Appearance: { getColorScheme: () => 'light', setColorScheme: () => {} },
    Platform: { OS: 'ios', select: (o) => (o.ios !== undefined ? o.ios : o.default) },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Alert: { alert: () => {} }, Linking: { openURL: () => Promise.resolve() },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const host = (name) => React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }));
  const Animated = { View: host('AnimatedView'), Text: host('AnimatedText'), createAnimatedComponent: (c) => c };
  return {
    __esModule: true, default: Animated, Animated,
    useSharedValue: (v) => ({ value: v }), useAnimatedStyle: (f) => f(), useAnimatedProps: (f) => f(),
    withSpring: (v) => v, withTiming: (v) => v, withRepeat: (v) => v, withSequence: (...a) => a[0], cancelAnimation: () => {},
    useReducedMotion: () => false, ReducedMotionConfig: () => null, ReduceMotion: { Always: 'always', System: 'system', Never: 'never' },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const icon = (name) => Object.assign(React.forwardRef((p, r) => React.createElement(name, { ...p, ref: r })), { glyphMap: {} });
  return { Ionicons: icon('Ionicons'), MaterialCommunityIcons: icon('MaterialCommunityIcons'), MaterialIcons: icon('MaterialIcons') };
});
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return { LinearGradient: React.forwardRef((p, r) => React.createElement('LinearGradient', { ...p, ref: r })) };
});
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return { SafeAreaView: React.forwardRef((p, r) => React.createElement('SafeAreaView', { ...p, ref: r })), useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-svg', () => {
  const React = require('react');
  const shape = (n) => React.forwardRef((p, r) => React.createElement(n, { ...p, ref: r }));
  return { __esModule: true, default: shape('Svg'), Svg: shape('Svg'), Circle: shape('Circle'), Line: shape('Line'), Path: shape('Path'), Rect: shape('Rect'), Polyline: shape('Polyline'), Polygon: shape('Polygon'), Stop: shape('Stop'), Text: shape('SvgText'), Defs: shape('Defs'), G: shape('G'), LinearGradient: shape('SvgLinearGradient') };
});
global.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('expo-router', () => ({ useSegments: () => global.__segments || ['(patient)', '(tabs)', 'today'] }));
