---
name: Lakeside WebRTC
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#476800'
  on-secondary: '#ffffff'
  secondary-container: '#b4f33e'
  on-secondary-container: '#4b6d00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#b7f641'
  secondary-fixed-dim: '#9cd920'
  on-secondary-fixed: '#131f00'
  on-secondary-fixed-variant: '#354e00'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  vibrant-lime: '#A6E42E'
  surface-gray: '#F5F5F5'
  border-subtle: '#E5E5E5'
  video-placeholder: '#1A1A1A'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  button:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.0'
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The design system is built on a foundation of **Minimalism** with a focus on functional clarity and high-end aesthetic precision. Designed for a WebRTC application, the interface prioritizes the content (video feeds and shared data) by utilizing vast amounts of white space, thin structural lines, and a high-contrast palette.

The emotional response should be one of "quiet reliability." By stripping away unnecessary ornamentation and using a vibrant lime-green accent against a stark monochrome backdrop, the UI feels both technologically advanced and human-centric. The visual language takes cues from Swiss design—prioritizing grid systems, clear typographic hierarchies, and a "less is more" approach to interface elements.

## Colors

The palette is strictly limited to ensure the primary accent has maximum impact.

- **Primary (Black):** Used for typography, primary iconography, and structural borders. It represents the "ink" on the digital canvas.
- **Secondary/Accent (Vibrant Lime):** This is the functional "signal" color. Use it exclusively for active states, notifications, "Join" buttons, or indicating that a microphone/camera is live.
- **Neutral (White):** The dominant surface color. It provides the "breathability" required for a clean, professional aesthetic.
- **Surface Gray:** A soft secondary background for toolbars or sidebar areas to create subtle separation without relying on heavy borders.

## Typography

This design system utilizes a trio of typefaces to achieve a modern, technical, yet accessible feel. 

- **Hanken Grotesk** is used for headlines and high-level UI elements, offering a sharp, contemporary geometric look.
- **Inter** provides maximum legibility for body text, chat logs, and settings menus.
- **JetBrains Mono** is introduced for technical metadata (e.g., bitrates, timestamps, participant counts) to reinforce the WebRTC application's professional, utility-driven nature.

All caps should be used sparingly for labels and buttons to create a structured, architectural feel.

## Layout & Spacing

The layout follows a **fluid grid** model with generous margins to prevent the UI from feeling cramped during multi-party calls.

- **The 8px Rule:** All spacing and sizing must be multiples of 8px to maintain a consistent visual rhythm.
- **Video Grid:** In a WebRTC context, the video grid should be dynamic. Use 24px gutters between video feeds. When a single speaker is focused, the primary container should maintain a 16:9 aspect ratio with a minimum 40px margin from the screen edges.
- **Sidebar/Controls:** Overlays and sidebars (like chat or participant lists) should use "safe area" padding of 24px. On desktop, sidebars are fixed at 320px; on mobile, they transition to full-screen modals.

## Elevation & Depth

This design system avoids traditional shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** Depth is created by placing white containers on a `#F5F5F5` (Surface Gray) background. 
- **Borders:** Instead of shadows, use 1px solid borders in `#000000` for primary elements or `#E5E5E5` for secondary separation.
- **Active State Elevation:** When an element is interacted with, it does not "rise" via a shadow; instead, it receives a 2px solid `#A6E42E` border or a solid black fill.
- **Glassmorphism:** Use a subtle backdrop blur (12px) for floating control bars that overlay video feeds, ensuring the controls remain legible without completely obscuring the video.

## Shapes

The shape language is strictly **Sharp (0px)**. 

To maintain the architectural, minimalist aesthetic, all buttons, input fields, video containers, and cards must have square corners. This creates a high-end, editorial feel that distinguishes the application from more consumer-oriented "rounded" competitors. The only exception is for circular status indicators (e.g., the "Live" dot).

## Components

- **Buttons:** Primary buttons are solid Black with White uppercase text. Secondary buttons are White with a 1px Black border. The "Action" button (e.g., Start Call) uses the Vibrant Lime fill with Black text.
- **Input Fields:** Minimalist design—only a 1px Black bottom border. On focus, the border thickens to 2px and the label (using JetBrains Mono) shifts upwards.
- **Video Tiles:** Sharp-edged containers. The active speaker is highlighted with a 2px Vibrant Lime border. Muted participants show a simple monochrome icon overlay.
- **Chips/Status:** Used for "REC" or "HD" indicators. These should be Black background with White text, using the `label-sm` typography.
- **Control Bar:** A floating horizontal bar at the bottom of the video feed. Use a semi-transparent white background with a backdrop blur. Icons should be 24px, stroke-based, and turn Vibrant Lime when active.
- **Cards:** Used in the dashboard for "Upcoming Meetings." Use a 1px `#E5E5E5` border and high-contrast typography for the meeting title.