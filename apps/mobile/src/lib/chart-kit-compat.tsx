import React from 'react';
import { BarChart as NativeBarChart, LineChart as NativeLineChart } from 'react-native-chart-kit';

export const LineChart = NativeLineChart as unknown as React.ComponentType<any>;
export const BarChart = NativeBarChart as unknown as React.ComponentType<any>;
