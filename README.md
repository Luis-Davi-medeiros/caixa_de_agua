# 🌊 ThermoLink Web App — Sistema de Automação & Dessalinização de Água

Painel web progressivo (PWA) de alta tecnologia para monitoramento e controle do sistema **ThermoLink (ESP8266 Mestre Caixa d'Água + ESP8266 Escravo Dessalinizador)**.

---

## 🚀 Funcionalidades Principais

1. **Visualizador Gráfico Interativo em Tempo Real**:
   - **Caixa d'Água Animada**: Reservatório com física de ondas líquidas em SVG/CSS, percentual numérico em destaque e mapeamento visual direto das boias de nível (`D1/25%`, `D2/50%`, `D5/75%`, `D6/100%`) e da **Boia Mecânica de Emergência (`D0`)**.
   - **Esquema Hidráulico do Dessalinizador**: Bombas animadas com rotores giratórios para o **Relé 1 (Bomba Principal)** e **Relé 2 (Bomba Auxiliar com retardo inteligente de 5 segundos)**.
   - **Medidor de Vazão Dinâmico**: Indicação em **L/min** com tubulação animada de fluxo contínuo.
   - **Status da Rede ESP-NOW**: Indicador da malha sem fio local com telemetria, contadores de pacotes e fail-safe de segurança.

2. **Estação de Comando Remoto**:
   - **Ligar Manual**: Com modal de seleção de tempo limite (5 min, 15 min, 30 min, 1h, 2h, 4h) e barra de progresso regressiva com contagem regressiva em tempo real.
   - **Parada de Emergência / Forçar Desligamento**: Desativa imediatamente todas as bombas e processos.
   - **Modo Automático Inteligente**: Controle 100% automático baseado nos sensores de nível de água.

3. **Telemetria & Gráfico Histórico**:
   - Gráfico dinâmico desenhado em Canvas (sem dependências externas) rastreando **Nível da Água (%)** e **Vazão Hidráulica (L/min)** ao longo do tempo.
   - Estimativa do **Volume Total de Água Dessalinizada/Bombeada (Litros)**.
   - Monitoramento do tempo de atividade (Uptime) e estado do sistema de segurança Fail-Safe.
   - Feed de histórico de eventos cronológico com logs coloridos por severidade.

4. **Bancada de Testes & Simulador Físico Integrado**:
   - Permite testar todo o comportamento do sistema diretamente no navegador sem precisar estar com os ESP8266s ligados:
     - Controle deslizante para variar o nível da água.
     - Simulação de disparo da boia mecânica de emergência.
     - Simulação de falha no sensor de fluxo.
     - Simulação de perda de sinal ESP-NOW.

5. **Três Modos de Conexão**:
   - **ESP8266 Local (Ponto de Acesso / Rede Local)**: Conecta-se diretamente à API REST do Mestre (`http://192.168.4.1` ou IP estático da sua rede).
   - **Nuvem (Google Apps Script / Webhooks)**: Suporte para consultas remotas via internet com JSONP e token de autenticação.
   - **Simulador / Modo Demonstração**: Ideal para apresentações e validações.

---

## 📁 Estrutura dos Arquivos

```
thermolink_web_app/
├── index.html       # Interface visual completa e semântica
├── styles.css       # Estilização futurista Glassmorphism, animações e responsividade
├── app.js           # Máquina de estados, motor de física do simulador, API REST e gráfico
├── manifest.json    # Suporte a instalação como App PWA no smartphone ou tablet
└── README.md        # Documentação e guia de uso
```

---

## 🛠️ Como Executar o Web App

### Opção 1: Abrir Diretamente no Navegador
Basta dar um duplo clique no arquivo [`index.html`](file:///c:/Users/Luis%20Davi/Desktop/PROJETO%20ANDERSON/thermolink_web_app/index.html) ou abri-lo no Google Chrome, Edge, Safari ou Firefox.

### Opção 2: Conectar ao ESP8266 Caixa d'Água (Mestre)
1. Ligue o ESP8266 Mestre (`ThermoLink_Caixa_Agua_Mestre_V3.0_OTIMIZADO.ino`).
2. No celular ou computador, conecte-se à rede Wi-Fi criada pelo ESP:
   - **SSID**: `THERMOLINK_CAIXA`
   - **Senha**: `12345678`
3. Abra o navegador e acesse:
   - `http://192.168.4.1/` (o próprio ESP serve os dados via `/api/status` e `/api/comando`).
4. No aplicativo, abra o menu de **Configurações ⚙️** e selecione a fonte **"ESP8266 Local"**.

---

## 🔌 Resumo dos Pinos do Hardware

### Caixa d'Água (Mestre)
| Pino | Função | Descrição |
| :--- | :--- | :--- |
| **D1** | Boia 25% | Nível 1 atingido (Pull-Up interno) |
| **D2** | Boia 50% | Nível 2 atingido (Pull-Up interno) |
| **D5** | Boia 75% | Nível 3 atingido (Pull-Up interno) |
| **D6** | Boia 100% | Caixa completamente cheia (Pull-Up interno) |
| **D0** | Boia Mecânica | Emergência de transbordamento / nível crítico |

### Dessalinizador (Escravo)
| Pino | Função | Descrição |
| :--- | :--- | :--- |
| **D0** | Relé 1 | Bomba principal do processo de dessalinização |
| **D1** | Relé 2 | Bomba auxiliar de pressurização (acionada 5s após o Relé 1) |
| **D7** | Sensor de Fluxo | Contador de pulsos por interrupção (450 pulsos/litro) |
