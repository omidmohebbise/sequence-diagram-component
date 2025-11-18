# Sequence Diagram Component

This project is a React + TypeScript implementation of an interactive sequence diagram component. It supports:

- Unlimited participants and messages rendered in SVG
- Sticky participant headers and footers
- Horizontal and vertical scrolling with synchronized lifelines
- Clickable message and note labels with rich popup content
- Configurable layout (spacing, fonts, offsets) via component props

## Getting Started

```bash
npm install
npm start
```

The development server runs at `http://localhost:3000`.

## Component Usage

```tsx
import SequenceDiagram, {
  SequenceParticipant,
  SequenceMessage,
} from "./components/SequenceDiagram";

const participants: SequenceParticipant[] = [
  { id: "user", name: "User" },
  { id: "server", name: "Server" },
];

const messages: SequenceMessage[] = [
  {
    from: "user",
    to: "server",
    label: "Login request",
    popup: { message: "POST /login", status: "Pending" },
  },
];

<SequenceDiagram participants={participants} messages={messages} />;
```

### `SequenceMessage.popup`

Each message can define a `popup` object:

```ts
type SequenceMessagePopup = {
  message: string;
  [key: string]: string;
};
```

Clicking a label displays this data.

## Project Scripts

- `npm start` – run the development build
- `npm run build` – create the production bundle
- `npm test` – execute tests (if defined)

## License

This project is provided as-is; feel free to adapt it to your own needs.

