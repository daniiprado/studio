# **App Name**: ServiAdventures

## Core Features:

- Firebase User Authentication: User authentication with Google using Firebase Authentication, storing user data (name, email, photoURL, UID) in a 'players' collection.  Includes an 'isOnline' flag (true on login, false on logout) and a 'lastActive' timestamp. Assigns a random avatar to each user upon creation.
- Calendar & Task Integration: Requests Google Calendar and Google Tasks access upon login. A collapsible sidebar on the right displays the day's calendar events and tasks.
- PixiJS Integration: Integration of PixiJS for the 2D world rendering.
- Map Generation from Firebase Storage: Downloads 'topDown_baseTiles.png' from Firebase Storage and programmatically renders a 2D map using PixiJS, representing tiles via a 2D matrix.
- Avatar & Player Movement: Downloads avatar sprites from Firebase Storage ('spr_alex.png', etc.), identifies sprite coordinates.  Online players are displayed on the map using their selected avatars and are moveable with WASD keys.
- Proximity Chat: Implements a proximity-based chat. Users near each other can initiate text chat or real-time voice chat via microphone. Users outside the proximity are unable to hear each other.
- Logout Functionality: Users can log out of the application.

## Style Guidelines:

- Primary color: Deep Indigo (#4B0082) to evoke a sense of mystery and futurism. Dark theme compatibility is considered.
- Background color: Very Dark Gray (#222222) to complement the futuristic dark design.
- Accent color: Electric Purple (#BF00FF) to provide highlights and call-to-action emphasis, contrasting with the deep indigo.
- Headline font: 'Space Grotesk' (sans-serif) for a modern, tech-inspired look; body font: 'Inter' (sans-serif) for readability and a clean interface.
- Futuristic icons with a minimalist style to match the overall aesthetic. Use of glowing or neon effects.
- A clean, modular layout that emphasizes the 2D map area. Sidebar on the right should be collapsible.
- Subtle, smooth transitions and animations for user interactions, providing a seamless user experience.