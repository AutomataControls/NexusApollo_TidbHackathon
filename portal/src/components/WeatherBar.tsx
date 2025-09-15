import React, { useState, useEffect } from 'react';
import {
  Cloud, CloudRain, CloudSnow, Sun, Wind,
  Thermometer, Droplets, Activity, Wifi, WifiOff
} from 'lucide-react';

interface WeatherBarProps {
  systemStatus: {
    online: boolean;
    hardware: boolean;
    apollo: boolean;
  };
}

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  icon: string;
  wind: number;
  location: string;
}

const WeatherBar: React.FC<WeatherBarProps> = ({ systemStatus }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Fetch weather data
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 600000); // Every 10 minutes

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  const fetchWeather = async () => {
    try {
      // Get user's location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      
      // Fetch weather from OpenWeatherMap API (you'll need to add your API key)
      const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
      if (apiKey) {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=imperial`
        );
        const data = await response.json();
        
        setWeather({
          temperature: Math.round(data.main.temp),
          humidity: data.main.humidity,
          condition: data.weather[0].main,
          icon: data.weather[0].icon,
          wind: Math.round(data.wind.speed),
          location: data.name
        });
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      // Set mock data for demo
      setWeather({
        temperature: 72,
        humidity: 45,
        condition: 'Clear',
        icon: '01d',
        wind: 8,
        location: 'New York'
      });
    }
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'clear':
        return <Sun size={20} />;
      case 'clouds':
        return <Cloud size={20} />;
      case 'rain':
      case 'drizzle':
        return <CloudRain size={20} />;
      case 'snow':
        return <CloudSnow size={20} />;
      default:
        return <Cloud size={20} />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="weather-bar">
      <div className="weather-left">
        {/* Weather Info */}
        {weather && (
          <div className="weather-info">
            <div className="weather-icon">
              {getWeatherIcon(weather.condition)}
            </div>
            <div className="weather-temp">
              {weather.temperature}°F
            </div>
            <div className="weather-details">
              <span className="weather-location">{weather.location}</span>
              <span className="weather-condition">{weather.condition}</span>
            </div>
            <div className="weather-metrics">
              <div className="metric">
                <Droplets size={16} />
                <span>{weather.humidity}%</span>
              </div>
              <div className="metric">
                <Wind size={16} />
                <span>{weather.wind} mph</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="weather-center">
        {/* Apollo Nexus Branding */}
        <div className="brand-section">
          <h1 className="brand-name">Apollo Nexus™</h1>
          <p className="brand-tagline">HVAC Intelligence Platform</p>
        </div>
      </div>

      <div className="weather-right">
        {/* System Status */}
        <div className="system-status">
          <div className={`status-item ${systemStatus.online ? 'online' : 'offline'}`}>
            {systemStatus.online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>System</span>
          </div>
          <div className={`status-item ${systemStatus.hardware ? 'online' : 'offline'}`}>
            <Activity size={16} />
            <span>Hardware</span>
          </div>
          <div className={`status-item ${systemStatus.apollo ? 'online' : 'offline'}`}>
            <Activity size={16} />
            <span>Apollo AI</span>
          </div>
        </div>

        {/* Date and Time */}
        <div className="datetime">
          <div className="time">{formatTime(time)}</div>
          <div className="date">{formatDate(time)}</div>
        </div>
      </div>
    </div>
  );
};

export default WeatherBar;