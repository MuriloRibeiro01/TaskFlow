import { Pressable, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticTabProps = {
  onPress?: (e: GestureResponderEvent) => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  children?: React.ReactNode;
  style?: object;
  [key: string]: unknown;
};

export function HapticTab({ onPressIn, children, ...props }: HapticTabProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    >
      {children}
    </Pressable>
  );
}
