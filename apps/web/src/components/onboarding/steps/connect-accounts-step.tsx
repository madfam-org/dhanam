'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@dhanam/ui';
import {
  CreditCardIcon,
  WalletIcon,
  BuildingIcon,
  PlusIcon,
  ArrowRightIcon,
  SkipForwardIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';

import { useOnboarding } from '../onboarding-provider';

const providers = [
  {
    id: 'belvo',
    name: 'Bancos Mexicanos',
    description: 'Conecta tus cuentas de bancos mexicanos (BBVA, Santander, Banorte, etc.)',
    icon: BuildingIcon,
    color: 'bg-blue-100 text-blue-600',
    region: 'México',
    type: 'Cuentas bancarias',
  },
  {
    id: 'plaid',
    name: 'Bancos Estadounidenses',
    description: 'Conecta tus cuentas bancarias de Estados Unidos',
    icon: CreditCardIcon,
    color: 'bg-green-100 text-green-600',
    region: 'Estados Unidos',
    type: 'Cuentas bancarias',
  },
  {
    id: 'bitso',
    name: 'Exchange Bitso',
    description: 'Sincroniza tu portafolio de criptomonedas de Bitso',
    icon: WalletIcon,
    color: 'bg-orange-100 text-orange-600',
    region: 'México',
    type: 'Criptomonedas',
  },
  {
    id: 'blockchain',
    name: 'Wallets Blockchain',
    description: 'Monitorea wallets Bitcoin y Ethereum (solo lectura)',
    icon: WalletIcon,
    color: 'bg-purple-100 text-purple-600',
    region: 'Global',
    type: 'Criptomonedas',
  },
];

export function ConnectAccountsStep() {
  const router = useRouter();
  const { updateStep, skipStep } = useOnboarding();
  const analytics = useAnalytics();
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleConnectProvider = (providerId: string) => {
    analytics.trackConnectInitiated(providerId as 'belvo' | 'plaid' | 'bitso');
    router.push(`/accounts/connect/${providerId}?onboarding=true`);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await updateStep('first_budget');
    } catch (error) {
      console.error('Error proceeding to next step:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await skipStep('connect_accounts');
    } catch (error) {
      console.error('Error skipping step:', error);
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-indigo-100 rounded-full mx-auto mb-6 flex items-center justify-center">
          <PlusIcon className="w-10 h-10 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Conecta tus cuentas</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Conecta tus cuentas bancarias y wallets para sincronizar automáticamente tus transacciones
          y obtener un análisis completo de tus finanzas
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className="hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <CardHeader>
              <CardTitle className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${provider.color}`}>
                    <provider.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-sm text-gray-500">
                      {provider.region} • {provider.type}
                    </p>
                  </div>
                </div>
                <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{provider.description}</p>
              <Button
                onClick={() => handleConnectProvider(provider.id)}
                className="w-full"
                variant="outline"
              >
                Conectar ahora
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">🔒 Tu seguridad es nuestra prioridad</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Todas las conexiones usan autenticación OAuth segura</li>
          <li>• Tus credenciales bancarias nunca se almacenan en nuestros servidores</li>
          <li>• Los datos se cifran con estándares bancarios (AES-256)</li>
          <li>• Solo accedemos a información de solo lectura</li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-yellow-900 mb-2">💡 ¿Por qué conectar tus cuentas?</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-yellow-800">
          <div>
            <h4 className="font-medium mb-1">Automatización total</h4>
            <p>Tus transacciones se importan y categorizan automáticamente</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Análisis en tiempo real</h4>
            <p>Ve tu situación financiera actualizada al instante</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Presupuestos inteligentes</h4>
            <p>Alertas automáticas cuando te acercas a tus límites</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Análisis ESG crypto</h4>
            <p>Evalúa el impacto ambiental de tus inversiones</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          variant="outline"
          size="lg"
          onClick={handleSkip}
          disabled={isSkipping}
          className="px-6"
        >
          <SkipForwardIcon className="w-4 h-4 mr-2" />
          {isSkipping ? 'Saltando...' : 'Saltar por ahora'}
        </Button>

        <Button size="lg" onClick={handleContinue} disabled={isLoading} className="px-6">
          {isLoading ? 'Cargando...' : 'Ya conecté mis cuentas'}
        </Button>
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Puedes conectar más cuentas después desde la sección de Cuentas
        </p>
      </div>
    </div>
  );
}
