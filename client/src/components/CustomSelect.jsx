import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';

const CustomSelect = ({ options, value, onChange, placeholder, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="trigger-content">
          {Icon && <Icon className="trigger-icon" />}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <FiChevronDown className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select-options glass-card">
          {options.map((option) => (
            <div 
              key={option.value} 
              className={`custom-select-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}

      <style jsx="true">{`
        .custom-select-container {
          position: relative;
          width: 100%;
          user-select: none;
        }
        .custom-select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #EAEAEA;
          font-size: 14px;
        }
        .custom-select-trigger:hover, .custom-select-trigger.open {
          border-color: #6C63FF;
          background: rgba(108, 99, 255, 0.05);
        }
        .trigger-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .trigger-icon {
          color: #A0A0B8;
        }
        .chevron {
          color: #A0A0B8;
          transition: transform 0.3s ease;
        }
        .chevron.rotate {
          transform: rotate(180deg);
        }
        .custom-select-options {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 1000;
          max-height: 300px;
          overflow-y: auto;
          background: #1A1A2E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.2s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-select-option {
          padding: 12px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #A0A0B8;
        }
        .custom-select-option:hover {
          background: rgba(108, 99, 255, 0.1);
          color: #EAEAEA;
        }
        .custom-select-option.selected {
          background: #6C63FF;
          color: white;
        }
        /* Scrollbar for options */
        .custom-select-options::-webkit-scrollbar {
          width: 4px;
        }
        .custom-select-options::-webkit-scrollbar-thumb {
          background: #6C63FF;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default CustomSelect;
