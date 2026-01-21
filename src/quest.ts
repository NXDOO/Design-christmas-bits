export type NPCType = 'decorator' | 'photographer' | 'bartender' | 'aa' | 'talker';

export class QuestManager {
  questStarted = false;
  tasks: Record<string, boolean> = {
    decorator: false,
    photographer: false,
    bartender: false,
  };

  startQuest() {
    this.questStarted = true;
  }

  isTaskNPC(type: string) {
    return type === 'decorator' || type === 'photographer' || type === 'bartender' || type === 'aa';
  }

  markCompleted(type: string) {
    if (type in this.tasks) this.tasks[type] = true;
  }

  isCompleted(type: string) {
    return !!this.tasks[type];
  }

  allTasksCompleted() {
    return this.tasks.decorator && this.tasks.photographer && this.tasks.bartender;
  }

  getNPCDialog(type: string) {
    switch (type) {
      case 'decorator': return 'Decorator: I need some decorations.';
      case 'photographer': return 'Photographer: I need help spotting differences.';
      case 'bartender': return 'Bartender: I need to mix some drinks.';
      case 'aa': return 'AA: The Christmas party is coming, can you help me?';
      default: return 'Hi!';
    }
  }
}

export default QuestManager;
