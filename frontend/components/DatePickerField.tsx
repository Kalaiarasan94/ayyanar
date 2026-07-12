import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS } from '../constants/Theme';

type DatePickerFieldProps = {
  value: string; // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  style?: any;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Local calendar date (not UTC) so late-night picks stay on the right day
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const displayDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES[m - 1]} ${y}`;
};

/**
 * Tap-to-open calendar date field. No typing:
 * - Android/iOS: opens the native calendar picker
 * - Web: uses the browser's built-in calendar (<input type="date">)
 */
export default function DatePickerField({ value, onChange, placeholder = 'Select date', style }: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.field, style]}>
        <MaterialIcons name="calendar-today" size={15} color={COLORS.textLight} />
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          onChange: (e: any) => onChange(e.target.value),
          'aria-label': placeholder,
          style: {
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: value ? COLORS.text : COLORS.textLight,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            padding: 0,
            marginLeft: 6,
            minWidth: 0,
          },
        })}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={[styles.field, style]} onPress={() => setShow(true)} activeOpacity={0.7}>
        <MaterialIcons name="calendar-today" size={15} color={COLORS.textLight} />
        <Text style={[styles.fieldText, !value && { color: COLORS.textLight }]} numberOfLines={1}>
          {value ? displayDate(value) : placeholder}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ? new Date(`${value}T12:00:00`) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            setShow(false);
            if (event.type !== 'dismissed' && selectedDate) {
              onChange(toYMD(selectedDate));
            }
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  fieldText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
