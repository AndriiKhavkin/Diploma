model_command_template = {
    "K1 Max": {
        "calibrate": ["G28", "G29"],
        "enclosure_on": ["M106 P2 S255"],   # приклад: ввімкнути вентилятор середовища
        "enclosure_off": ["M106 P2 S0"]     # вимкнути
    },
    "Ender 3 KE": {
        "calibrate": ["G29"]
    },
    "Other": {
        "calibrate": ["G29"]
    },
    "Unknown": {
        "calibrate": ["G29"]
    }
}
