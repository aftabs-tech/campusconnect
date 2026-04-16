import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';

const CustomSelect = ({ options, value, onChange, placeholder, icon: Icon, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

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
    <div className={`custom-select-container ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${!selectedOption ? 'placeholder' : ''} ${disabled ? 'disabled' : ''}`} 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="trigger-content">
          {Icon && <Icon className="trigger-icon" />}
          <span>{selectedOption ? selectedOption.label : (placeholder || 'Select option')}</span>
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
          background: var(--bg-glass);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: var(--text-muted);
          font-size: 14px;
        }
        .custom-select-trigger.placeholder {
          color: var(--text-secondary);
        }
        .custom-select-trigger.placeholder .trigger-icon,
        .custom-select-trigger.placeholder .chevron {
          color: var(--text-secondary);
        }
        .custom-select-trigger.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(0, 0, 0, 0.05);
          filter: grayscale(1);
        }
        .custom-select-trigger:not(.disabled):hover, .custom-select-trigger:not(.disabled).open {
          border-color: var(--primary);
          background: rgba(108, 99, 255, 0.05);
        }
        .trigger-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .trigger-icon {
          color: var(--text-muted);
        }
        .chevron {
          color: var(--text-muted);
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
          z-index: 9999;
          max-height: 300px;
          overflow-y: auto;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
          border-radius: 12px;
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
          color: var(--text-muted);
        }
        .custom-select-option:hover {
          background: rgba(108, 99, 255, 0.1);
          color: var(--primary);
        }
        .custom-select-option.selected {
          background: var(--primary);
          color: white;
        }
        .custom-select-trigger span:empty::before {
          content: attr(data-placeholder);
          color: var(--text-secondary);
        }
        /* Scrollbar for options */
        .custom-select-options::-webkit-scrollbar {
          width: 4px;
        }
        .custom-select-options::-webkit-scrollbar-thumb {
          background: var(--primary);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default CustomSelect;
