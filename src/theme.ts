export type Theme = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  buttonText: string;
};

export const light: Theme = {
  bg: '#EEF1F6',
  surface: '#FFFFFF',
  ink: '#17203A',
  muted: '#5D6680',
  line: '#D6DBE7',
  accent: '#D6402B',
  buttonText: '#EEF1F6',
};

export const dark: Theme = {
  bg: '#0F1424',
  surface: '#181F35',
  ink: '#EEF1F8',
  muted: '#9AA3BD',
  line: '#2A3352',
  accent: '#FF6A52',
  buttonText: '#0F1424',
};
