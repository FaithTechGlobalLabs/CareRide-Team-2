import { useEffect, useState } from "react"
import { vancouverMinutes } from "./dates"

const staffEyebrows = [
  "LET’S KEEP OUR COMMUNITY MOVING",
  "A LITTLE HELP GOES A LONG WAY",
  "CONNECTING OUR COMMUNITY TO CARE",
  "MAKING ROOM FOR EVERY JOURNEY",
  "TOGETHER, WE MAKE A WAY FORWARD",
  "CARE STARTS WITH CONNECTION",
  "SMALL STEPS. STRONGER COMMUNITIES.",
  "HELPING OUR NEIGHBOURS GET THERE",
  "EVERY JOURNEY STARTS WITH YOU",
  "LET’S MAKE CARE MORE ACCESSIBLE",
]
const staffDescriptions = [
  "A little coordination. A meaningful difference.",
  "Every ride you arrange brings someone closer to care.",
  "Small acts of planning open doors to possibility.",
  "Your care helps our community move forward.",
  "One thoughtful connection can change someone’s day.",
  "A little teamwork makes the journey easier.",
  "You bring people and helping hands together.",
  "A few moments of coordination. A journey that matters.",
  "Helping someone get there starts right here.",
  "Every connection is another step toward care.",
]
const driverEyebrows = [
  "YOUR TIME MAKES A DIFFERENCE",
  "A HELPING HAND BEHIND THE WHEEL",
  "EVERY RIDE IS A CONNECTION",
  "YOU HELP OUR COMMUNITY MOVE",
  "A LITTLE TIME. A WAY FORWARD.",
  "BRINGING CARE WITHIN REACH",
  "YOUR NEXT JOURNEY CAN MATTER",
  "THANK YOU FOR MAKING A WAY",
  "GOOD NEIGHBOURS. MEANINGFUL JOURNEYS.",
  "LET’S GET PEOPLE TO CARE",
]
const driverDescriptions = [
  "A ride from you can open a world of possibilities.",
  "Your time helps someone reach the care they need.",
  "A little kindness travels a long way.",
  "Every journey is a chance to make someone’s day easier.",
  "You bring a helping hand to the road ahead.",
  "A shared journey can mean one less worry.",
  "Your willingness to help makes care more reachable.",
  "One ride at a time, you help our community move forward.",
  "A seat in your car can open a door to care.",
  "The time you give makes a meaningful difference.",
]
const clearTitles = [
  "A clear day.",
  "A little breathing room.",
  "An open road today.",
  "Room to recharge.",
  "A pause between journeys.",
  "Some time for you.",
  "A quieter schedule.",
  "Space in your day.",
  "A day with room to spare.",
  "No committed journeys today.",
]
const clearDescriptions = [
  "No rides are booked for you today.",
  "Your ride schedule is clear today.",
  "You have no assigned rides today.",
  "There are no committed rides on today’s schedule.",
  "No pickups are scheduled for you today.",
  "Today has no assigned journeys.",
  "You’re free of ride commitments today.",
  "No rides are on your calendar today.",
  "There are no booked journeys for you today.",
  "Your calendar has room today.",
]

// Draw from a shuffled bag so each phrase gets a turn before it repeats.
const bags = new Map<readonly string[], string[]>()
export function shuffledText(choices: readonly string[]) {
  let bag = bags.get(choices)
  if (!bag?.length) {
    bag = [...choices]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    bags.set(choices, bag)
  }
  return bag.pop()!
}

export function useLocalNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function timeOfDay(now: Date) {
  const hour = vancouverMinutes(now.toISOString()) / 60
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"
}

const greetings = [
  "Hello",
  "Good day",
  "Hi",
  "Welcome back",
  "time",
  "time",
  "time",
]
export function usePersonalText(name: string, driver = false) {
  const now = useLocalNow()
  const [copy] = useState(() => ({
    eyebrow: shuffledText(driver ? driverEyebrows : staffEyebrows),
    description: shuffledText(driver ? driverDescriptions : staffDescriptions),
    greeting: shuffledText(greetings),
  }))
  const greeting =
    copy.greeting === "time" ? `Good ${timeOfDay(now)}` : copy.greeting
  return { ...copy, title: `${greeting}, ${name}.` }
}

export function useClearDayText(now: Date) {
  const [copy] = useState(() => ({
    title: shuffledText(clearTitles),
    description: shuffledText(clearDescriptions),
  }))
  return {
    ...copy,
    description: `${copy.description} Enjoy a little time for yourself this ${timeOfDay(now)}.`,
  }
}
