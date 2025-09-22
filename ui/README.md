# Vimana Universe React Component

This directory stores a self-contained React component for the "Vimana Universe"
interface referenced in TamaOS lore. The component is written in TypeScript and
styled with Tailwind CSS utility classes. It does not require any of the Python
runtime and can be copied into a React application created with Vite, Next.js or
Create React App.

## Usage

1. Install the peer dependency that provides the icons:
   ```bash
   npm install lucide-react
   ```
2. Ensure Tailwind CSS is configured in your project so the utility classes in
   `VimanaUniverse.tsx` render correctly.
3. Import and render the component in your application:
   ```tsx
   import VimanaUniverse from "./VimanaUniverse";

   export default function App() {
     return <VimanaUniverse />;
   }
   ```

The component handles keyboard navigation, scanning interactions, and a simulated
communications console entirely on the client.
