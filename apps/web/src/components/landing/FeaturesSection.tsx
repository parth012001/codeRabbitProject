'use client';

import { motion } from 'framer-motion';
import { landingContent } from '@/config/landingContent';

export const FeaturesSection = () => {
  return (
    <section
      id="features"
      className="min-h-screen flex items-center justify-center py-24 px-6 bg-gradient-to-br from-blue-50 via-purple-50/30 to-white relative scroll-mt-20"
    >
      {/* Decorative gradient orbs */}
      <motion.div
        className="absolute top-20 right-10 w-72 h-72 bg-gradient-to-r from-blue-300/30 to-purple-300/30 rounded-full filter blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            {landingContent.features.title}
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            {landingContent.features.subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-10 mb-16">
          {landingContent.features.mainFeatures.map((feature, index) => (
            <motion.div
              key={index}
              className="text-center group"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <motion.div
                className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg`}
                whileHover={{ scale: 1.2, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={feature.icon}
                  />
                </svg>
              </motion.div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Additional Features Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {landingContent.features.additionalFeatures.map((item, index) => (
            <motion.div
              key={index}
              className={`bg-gradient-to-br ${item.gradient} rounded-2xl p-8 border-2 ${item.border} shadow-lg`}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="flex items-start gap-5">
                <motion.div
                  className={`w-12 h-12 bg-gradient-to-br ${item.iconGradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                </motion.div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 text-lg">{item.title}</h4>
                  <p className="text-slate-700 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
