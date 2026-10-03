import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/home/HomeScreen";
import { ReportsScreen } from "../screens/reports/ReportsScreen";
import { MessagesScreen } from "../screens/messages/MessagesScreen";
import { CalendarScreen } from "../screens/calendar/CalendarScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { BottomNavigation } from "../components/design/System";
export type MainTabParamList = {
  Home: undefined;
  Reports: undefined;
  Messages: undefined;
  Calendar: undefined;
  Profile: undefined;
};
const Tab = createBottomTabNavigator<MainTabParamList>();
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <BottomNavigation
          active={state.routes[state.index].name}
          onSelect={(name) => {
            const target = state.routes.find((r) => r.name === name);
            if (!target) return;
            const event = navigation.emit({
              type: "tabPress",
              target: target.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) navigation.navigate(name);
          }}
        />
      )}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
