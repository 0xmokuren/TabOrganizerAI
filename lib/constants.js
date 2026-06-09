export const GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
];

export const MAX_TABS_PER_REQUEST = 40;
export const MIN_TABS_FOR_GROUP = 2;

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string' },
          tabIndices: {
            type: 'array',
            items: { type: 'integer' },
          },
        },
        required: ['name', 'tabIndices'],
      },
    },
  },
  required: ['groups'],
};
